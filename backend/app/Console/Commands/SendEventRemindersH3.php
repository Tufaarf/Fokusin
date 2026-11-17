<?php

namespace App\Console\Commands;

use App\Events\EventReminderSent;
use App\Models\CalendarEvent;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendEventRemindersH3 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'events:remind-h3';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Kirim notifikasi pengingat harian untuk acara H-3, H-2, dan H-1 ke tabel notifikasi dan broadcast via WebSocket';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today();
        $startDate = $today->copy()->addDay()->toDateString(); // CURRENT_DATE + 1 day (H-1)
        $endDate = $today->copy()->addDays(3)->toDateString();  // CURRENT_DATE + 3 days (H-3)

        $this->info("Menjalankan scheduler pengingat H-3 untuk periode {$startDate} s/d {$endDate}...");

        // Query seluruh CalendarEvents dengan event_date antara CURRENT_DATE + 1 day hingga CURRENT_DATE + 3 days
        $events = CalendarEvent::with(['user', 'project.members'])
            ->whereBetween('event_date', [$startDate, $endDate])
            ->get();

        if ($events->isEmpty()) {
            $this->info("Tidak ada agenda kalender yang jatuh tempo dalam H-3 s/d H-1 hari ini.");
            return Command::SUCCESS;
        }

        $sentCount = 0;

        foreach ($events as $event) {
            $eventDate = Carbon::parse($event->event_date)->startOfDay();
            $daysRemaining = $today->diffInDays($eventDate, false);
            $hTag = "H-{$daysRemaining}";

            // Tentukan seluruh pengguna yang berhak menerima pengingat:
            // 1. Pembuat event
            // 2. Seluruh anggota project jika event terafiliasi dengan sebuah project
            $recipientIds = collect([$event->user_id]);

            if ($event->project && $event->project->members) {
                $recipientIds = $recipientIds->merge($event->project->members->pluck('id'));
            }

            $recipientIds = $recipientIds->unique()->filter();

            foreach ($recipientIds as $userId) {
                // Hindari duplikasi notifikasi untuk event dan hari yang sama
                $alreadyNotifiedToday = Notification::where('user_id', $userId)
                    ->where('type', 'EVENT_REMINDER_H3')
                    ->whereDate('created_at', $today)
                    ->whereJsonContains('data->event_id', $event->id)
                    ->exists();

                if ($alreadyNotifiedToday) {
                    continue;
                }

                $title = "Pengingat {$hTag}: {$event->title}";
                $message = "Agenda '{$event->title}' dijadwalkan pada {$event->event_date->format('d M Y')} pukul {$event->time}. Siapkan materi Anda.";

                $notification = Notification::create([
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $message,
                    'type' => 'EVENT_REMINDER_H3',
                    'data' => [
                        'event_id' => $event->id,
                        'event_title' => $event->title,
                        'event_date' => $event->event_date->toDateString(),
                        'time' => $event->time,
                        'days_remaining' => $daysRemaining,
                        'h_tag' => $hTag,
                        'project_id' => $event->project_id,
                    ],
                    'is_read' => false,
                ]);

                // Emit event via WebSocket (ShouldBroadcastNow)
                try {
                    broadcast(new EventReminderSent($notification, $userId));
                } catch (\Throwable $e) {
                    Log::warning("Gagal broadcast WebSocket pengingat: " . $e->getMessage());
                }

                $sentCount++;
            }
        }

        $this->info("Berhasil mengirimkan {$sentCount} notifikasi pengingat H-3.");
        return Command::SUCCESS;
    }
}
