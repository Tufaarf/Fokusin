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

        // Default: reminder
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
            'message' => 'Simulasi reminder berhasil dikirim',
            'notification' => $notification,
        ]);
    }
}
