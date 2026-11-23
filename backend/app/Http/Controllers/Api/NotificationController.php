<?php

namespace App\Http\Controllers\Api;

use App\Events\ChatMessageSent;
use App\Events\EventReminderSent;
use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatRoom;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get user notifications
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $notifications = Notification::where('user_id', $currentUser->id)
            ->orderBy('created_at', 'desc')
            ->limit(30)
            ->get();

        $unreadCount = Notification::where('user_id', $currentUser->id)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'data' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * Mark a single notification as read
     */
    public function markAsRead(Request $request, string|int $id): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        Notification::where('id', $id)
            ->where('user_id', $currentUser->id)
            ->update(['is_read' => true]);

        return response()->json(['message' => 'Notification marked as read']);
    }

    /**
     * Mark all notifications as read for current user
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        Notification::where('user_id', $currentUser->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['message' => 'All notifications marked as read']);
    }

    /**
     * Simulate a realtime notification for testing (reminder or incoming chat message)
     */
    public function simulate(Request $request): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $type = $request->input('type', 'reminder');

        if ($type === 'message') {
            $sender = User::where('id', '!=', $currentUser->id)->first() ?? $currentUser;
            $room = ChatRoom::whereHas('participants', fn($p) => $p->where('users.id', $currentUser->id))->first()
                ?? ChatRoom::first();

            $roomId = $room ? $room->id : 'chat-orbit';
            $msgText = $request->input('message', 'Halo! Ini adalah simulasi realtime pesan masuk.');

            $chatMessage = ChatMessage::create([
                'chat_room_id' => $roomId,
                'user_id' => $sender->id,
                'message' => $msgText,
            ]);

            $chatMessage->load(['chatRoom.participants', 'sender']);

            $notification = Notification::create([
                'user_id' => $currentUser->id,
                'title' => $sender->name . ($room ? " ({$room->name})" : ''),
                'message' => $msgText,
                'type' => 'CHAT_MESSAGE',
                'data' => [
                    'chat_room_id' => $roomId,
                    'chat_room_name' => $room?->name ?? 'Orbit Mobile App',
                    'sender_id' => $sender->id,
                    'sender_name' => $sender->name,
                ],
                'is_read' => false,
            ]);

            try {
                broadcast(new ChatMessageSent($chatMessage));
            } catch (\Throwable $e) {
                // broadcast fallback
            }

            return response()->json([
                'message' => 'Simulasi pesan baru berhasil dikirim',
                'notification' => $notification,
            ]);
        }

        if ($type === 'task' || $type === 'task_reminder') {
            $taskTitle = $request->input('title', 'Finalisasi Arsitektur Database & API Contract');
            $hTag = $request->input('h_tag', 'H-3');
            $msg = $request->input('message', "Tugas '{$taskTitle}' pada project 'Core Platform' jatuh tempo dalam 3 hari lagi ({$hTag}). Segera selesaikan sebelum batas waktu.");

            $notification = Notification::create([
                'user_id' => $currentUser->id,
                'title' => "Pengingat {$hTag}: {$taskTitle}",
                'message' => $msg,
                'type' => 'TASK_REMINDER_H3',
                'data' => [
                    'h_tag' => $hTag,
                    'task_id' => $request->input('task_id', 'TASK-SIM-01'),
                    'task_title' => $taskTitle,
                    'project_id' => 'proj-demo',
                    'project_name' => 'Core Platform',
                    'due_date' => Carbon::now()->addDays(3)->toISOString(),
                    'days_remaining' => 3,
                ],
                'is_read' => false,
            ]);

            try {
                broadcast(new EventReminderSent($notification, $currentUser->id));
            } catch (\Throwable $e) {
                // broadcast fallback
            }

            return response()->json([
                'message' => 'Simulasi reminder task berhasil dikirim',
                'notification' => $notification,
            ]);
        }

        // Default: reminder kalender
        $title = $request->input('title', 'Pengingat H-2: Sprint Review & Release');
        $msg = $request->input('message', 'Agenda akan berlangsung besok pukul 10:00 WIB. Jangan lupa siapkan laporan.');

        $notification = Notification::create([
            'user_id' => $currentUser->id,
            'title' => $title,
            'message' => $msg,
            'type' => 'EVENT_REMINDER_H3',
            'data' => [
                'h_tag' => 'H-2',
                'event_date' => Carbon::tomorrow()->toDateString(),
                'time' => '10:00 WIB',
            ],
            'is_read' => false,
        ]);

        try {
            broadcast(new EventReminderSent($notification, $currentUser->id));
        } catch (\Throwable $e) {
            // broadcast fallback
        }

        return response()->json([
            'message' => 'Simulasi reminder kalender berhasil dikirim',
            'notification' => $notification,
        ]);
    }

    /**
     * Trigger manual pengecekan pengingat H-3 untuk kalender & task
     */
    public function triggerH3(Request $request): JsonResponse
    {
        $testEmail = $request->input('test_email');
        $force = $request->boolean('force', true);

        $params = [];
        if ($testEmail) {
            $params['--test-email'] = $testEmail;
        }
        if ($force) {
            $params['--force'] = true;
        }

        \Illuminate\Support\Facades\Artisan::call('events:remind-h3', $params);
        $output = \Illuminate\Support\Facades\Artisan::output();

        return response()->json([
            'message' => 'Proses pengingat H-3 berhasil dijalankan',
            'output' => $output,
        ]);
    }

    /**
     * Webhook Cron Eksternal untuk Railway / Cron-Job.org / Cloud Scheduler
     * Bebas dipanggil otomatis via GET atau POST dengan proteksi opsional CRON_SECRET
     */
    public function cronTrigger(Request $request): JsonResponse
    {
        $expectedSecret = env('CRON_SECRET');
        $providedSecret = $request->input('key') ?? $request->input('secret') ?? $request->header('X-Cron-Key');

        if ($expectedSecret && $providedSecret !== $expectedSecret) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized: Invalid CRON_SECRET key',
            ], 403);
        }

        $force = $request->boolean('force', false);
        $testEmail = $request->input('test_email');

        $params = [];
        if ($force) {
            $params['--force'] = true;
        }
        if ($testEmail) {
            $params['--test-email'] = $testEmail;
        }

        \Illuminate\Support\Facades\Artisan::call('events:remind-h3', $params);
        $output = \Illuminate\Support\Facades\Artisan::output();

        return response()->json([
            'status' => 'success',
            'message' => 'Scheduler pengingat H-3 berhasil dijalankan melalui Webhook Cron',
            'output' => $output,
        ]);
    }
}
