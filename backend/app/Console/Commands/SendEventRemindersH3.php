<?php

namespace App\Console\Commands;

use App\Events\EventReminderSent;
use App\Mail\CalendarReminderMail;
use App\Mail\TaskReminderMail;
use App\Models\CalendarEvent;
use App\Models\Notification;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendEventRemindersH3 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'events:remind-h3 
                            {--test-email= : Kirim email uji coba ke alamat tertentu}
                            {--force : Abaikan pengecekan duplikasi notifikasi hari ini}
                            {--dry-run : Jalankan simulasi tanpa mengirim email atau menyimpan notifikasi}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Kirim email pengingat H-3 s/d H-1 untuk event kalender dan task project ke pemilik masing-masing via officialfokusin@gmail.com';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today();
        $startDate = $today->copy()->addDay()->toDateString(); // H-1
        $endDate = $today->copy()->addDays(3)->toDateString();  // H-3
        $startDateTime = $today->copy()->addDay()->startOfDay();
        $endDateTime = $today->copy()->addDays(3)->endOfDay();

        $testEmail = $this->option('test-email');
        $force = (bool) $this->option('force');
        $dryRun = (bool) $this->option('dry-run');

        $senderAddress = config('mail.from.address', 'officialfokusin@gmail.com');
        $this->info("===============================================================");
        $this->info(" Menjalankan Scheduler Pengingat H-3 Fokusin");
        $this->info(" Periode: {$startDate} s/d {$endDate}");
        $this->info(" Pengirim Email: {$senderAddress}");
        if ($dryRun) {
            $this->warn(" Mode: DRY-RUN (Simulasi aktif, tidak ada email/data tersimpan)");
        }
        $this->info("===============================================================");

        $eventsSent = $this->processCalendarEvents($today, $startDate, $endDate, $testEmail, $force, $dryRun);
        $tasksSent = $this->processProjectTasks($today, $startDateTime, $endDateTime, $testEmail, $force, $dryRun);

        $totalSent = $eventsSent + $tasksSent;
        $this->info("---------------------------------------------------------------");
        $this->info("Selesai! Total pengingat diproses: {$totalSent} ({$eventsSent} agenda, {$tasksSent} task).");
        $this->info("===============================================================");

        return Command::SUCCESS;
    }

    /**
     * Proses pengingat agenda kalender
     */
    protected function processCalendarEvents(Carbon $today, string $startDate, string $endDate, ?string $testEmail, bool $force, bool $dryRun): int
    {
        $this->info("\n[1/2] Memeriksa Agenda Kalender (H-3 s/d H-1)...");

        $events = CalendarEvent::with(['user', 'project.members'])
            ->whereBetween('event_date', [$startDate, $endDate])
            ->get();

        if ($events->isEmpty()) {
            $this->line(" - Tidak ada agenda kalender dalam rentang H-3 s/d H-1 hari ini.");
            return 0;
        }

        $sentCount = 0;

        foreach ($events as $event) {
            $eventDate = Carbon::parse($event->event_date)->startOfDay();
            $daysRemaining = $today->diffInDays($eventDate, false);
            $hTag = "H-{$daysRemaining}";

            // Pemilik calendar
            $owner = $event->user;
            if (!$owner) {
                continue;
            }

            // Tentukan penerima in-app notifikasi: pemilik + member project jika ada
            $recipientIds = collect([$owner->id]);
            if ($event->project && $event->project->members) {
                $recipientIds = $recipientIds->merge($event->project->members->pluck('id'));
            }
            $recipientIds = $recipientIds->unique()->filter();

            // 1. Kirim Email ke pemilik calendar
            $targetEmail = $testEmail ?: $owner->email;
            $alreadyNotifiedOwner = !$force && Notification::where('user_id', $owner->id)
                ->where('type', 'EVENT_REMINDER_H3')
                ->whereDate('created_at', $today)
                ->whereJsonContains('data->event_id', $event->id)
                ->exists();

            if (!$alreadyNotifiedOwner && !empty($targetEmail)) {
                if ($dryRun) {
                    $this->line(" [DRY-RUN] Simulasi email agenda '{$event->title}' ({$hTag}) ke pemilik: {$targetEmail}");
                } else {
                    try {
                        Mail::to($targetEmail)->send(new CalendarReminderMail(
                            $event,
                            $owner,
                            $daysRemaining,
                            $hTag,
                            config('app.url', 'http://localhost:8000')
                        ));
                        $this->info(" ✓ Email agenda '{$event->title}' ({$hTag}) terkirim ke pemilik: {$targetEmail}");
                    } catch (\Throwable $e) {
                        Log::error("Gagal mengirim email pengingat agenda ID {$event->id} ke {$targetEmail}: " . $e->getMessage());
                        $this->warn(" ! Gagal mengirim email agenda ke {$targetEmail}: " . $e->getMessage());
                    }
                }
            }

            // 2. Buat in-app notification & broadcast untuk seluruh penerima
            foreach ($recipientIds as $userId) {
                $alreadyNotifiedUser = !$force && Notification::where('user_id', $userId)
                    ->where('type', 'EVENT_REMINDER_H3')
                    ->whereDate('created_at', $today)
                    ->whereJsonContains('data->event_id', $event->id)
                    ->exists();

                if ($alreadyNotifiedUser) {
                    continue;
                }

                $title = "Pengingat {$hTag}: {$event->title}";
                $eventDateStr = $event->event_date ? $event->event_date->format('d M Y') : $eventDate->format('d M Y');
                $message = "Agenda '{$event->title}' dijadwalkan pada {$eventDateStr} pukul {$event->time}. Siapkan materi Anda.";

                if ($dryRun) {
                    $this->line(" [DRY-RUN] Simulasi in-app notification agenda untuk user #{$userId}");
                } else {
                    $notification = Notification::create([
                        'user_id' => $userId,
                        'title' => $title,
                        'message' => $message,
                        'type' => 'EVENT_REMINDER_H3',
                        'data' => [
                            'event_id' => $event->id,
                            'event_title' => $event->title,
                            'event_date' => $event->event_date ? $event->event_date->toDateString() : $eventDate->toDateString(),
                            'time' => $event->time,
                            'days_remaining' => $daysRemaining,
                            'h_tag' => $hTag,
                            'project_id' => $event->project_id,
                        ],
                        'is_read' => false,
                    ]);

                    // Broadcast via WebSocket
                    try {
                        broadcast(new EventReminderSent($notification, $userId));
                    } catch (\Throwable $e) {
                        Log::warning("Gagal broadcast WebSocket pengingat agenda: " . $e->getMessage());
                    }
                }

                $sentCount++;
            }
        }

        return $sentCount;
    }

    /**
     * Proses pengingat deadline task pada project
     */
    protected function processProjectTasks(Carbon $today, Carbon $startDateTime, Carbon $endDateTime, ?string $testEmail, bool $force, bool $dryRun): int
    {
        $this->info("\n[2/2] Memeriksa Task Project (H-3 s/d H-1)...");

        $tasks = Task::with(['project.creator', 'assignee'])
            ->whereNotNull('due_date')
            ->whereNotIn('status', ['done', 'completed'])
            ->whereBetween('due_date', [$startDateTime, $endDateTime])
            ->get();

        if ($tasks->isEmpty()) {
            $this->line(" - Tidak ada task project yang jatuh tempo dalam H-3 s/d H-1 hari ini.");
            return 0;
        }

        $sentCount = 0;

        foreach ($tasks as $task) {
            $dueDate = Carbon::parse($task->due_date);
            $daysRemaining = $today->diffInDays($dueDate->copy()->startOfDay(), false);
            $hTag = "H-{$daysRemaining}";

            // Tentukan pemilik task (assignee utama, atau fallback pembuat project)
            $taskOwner = null;
            if ($task->assignee) {
                $taskOwner = $task->assignee;
            } elseif ($task->assignee_id) {
                $taskOwner = User::find($task->assignee_id);
            } elseif ($task->assignee_name) {
                $taskOwner = User::where('name', $task->assignee_name)->first();
            }

            if (!$taskOwner && $task->project && $task->project->creator) {
                $taskOwner = $task->project->creator;
            }

            if (!$taskOwner) {
                $this->line(" - Task '{$task->title}' tidak memiliki pemilik/assignee yang terdaftar di database.");
                continue;
            }

            // Cek anti duplikasi notifikasi & email hari ini
            $alreadyNotified = !$force && Notification::where('user_id', $taskOwner->id)
                ->where('type', 'TASK_REMINDER_H3')
                ->whereDate('created_at', $today)
                ->whereJsonContains('data->task_id', $task->id)
                ->exists();

            if ($alreadyNotified) {
                continue;
            }

            $targetEmail = $testEmail ?: $taskOwner->email;

            // 1. Kirim Email ke pemilik task
            if (!empty($targetEmail)) {
                if ($dryRun) {
                    $this->line(" [DRY-RUN] Simulasi email task '{$task->title}' ({$hTag}) ke pemilik: {$targetEmail}");
                } else {
                    try {
                        Mail::to($targetEmail)->send(new TaskReminderMail(
                            $task,
                            $taskOwner,
                            $daysRemaining,
                            $hTag,
                            config('app.url', 'http://localhost:8000')
                        ));
                        $this->info(" ✓ Email task '{$task->title}' ({$hTag}) terkirim ke pemilik: {$targetEmail}");
                    } catch (\Throwable $e) {
                        Log::error("Gagal mengirim email pengingat task ID {$task->id} ke {$targetEmail}: " . $e->getMessage());
                        $this->warn(" ! Gagal mengirim email task ke {$targetEmail}: " . $e->getMessage());
                    }
                }
            }

            // 2. Buat in-app notification & broadcast
            $projectName = $task->project ? $task->project->name : 'Project';
            $title = "Pengingat {$hTag}: {$task->title}";
            $formattedDueDate = $dueDate->format('d M Y - H:i');
            $message = "Tugas '{$task->title}' pada project '{$projectName}' jatuh tempo pada {$formattedDueDate} WIB. Segera selesaikan sebelum batas waktu.";

            if ($dryRun) {
                $this->line(" [DRY-RUN] Simulasi in-app notification task untuk user #{$taskOwner->id} ({$taskOwner->name})");
            } else {
                $notification = Notification::create([
                    'user_id' => $taskOwner->id,
                    'title' => $title,
                    'message' => $message,
                    'type' => 'TASK_REMINDER_H3',
                    'data' => [
                        'task_id' => $task->id,
                        'task_title' => $task->title,
                        'project_id' => $task->project_id,
                        'project_name' => $projectName,
                        'due_date' => $task->due_date ? $dueDate->toISOString() : null,
                        'days_remaining' => $daysRemaining,
                        'h_tag' => $hTag,
                        'priority' => $task->priority,
                        'status' => $task->status,
                    ],
                    'is_read' => false,
                ]);

                // Broadcast via WebSocket
                try {
                    broadcast(new EventReminderSent($notification, $taskOwner->id));
                } catch (\Throwable $e) {
                    Log::warning("Gagal broadcast WebSocket pengingat task: " . $e->getMessage());
                }
            }

            $sentCount++;
        }

        return $sentCount;
    }
}
