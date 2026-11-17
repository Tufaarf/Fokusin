<?php

namespace App\Http\Controllers\Api;

use App\Events\ChatMessageSent;
use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatParticipant;
use App\Models\ChatRoom;
use App\Models\User;
use App\Services\TaskMentionParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    /**
     * Get all chat rooms for current user
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        $currentUserId = $currentUser?->id;

        $rooms = ChatRoom::with(['participants', 'messages.sender'])
            ->when($currentUserId, function ($q) use ($currentUserId) {
                $q->whereHas('participants', fn($p) => $p->where('users.id', $currentUserId));
            })
            ->get();

        $formatted = $rooms->map(function ($room) use ($currentUser, $currentUserId) {
            $participant = $room->participants->firstWhere('id', $currentUserId);
            $lastReadAt = $participant?->pivot?->last_read_at;

            $unreadCount = $room->messages
                ->where('user_id', '!=', $currentUserId)
                ->filter(fn($m) => !$lastReadAt || $m->created_at > $lastReadAt)
                ->count();

            $messages = $room->messages->map(function ($msg) use ($currentUserId) {
                return [
                    'id' => (string) $msg->id,
                    'sender' => $msg->sender?->name ?? 'User',
                    'text' => $msg->message,
                    'time' => $msg->created_at->format('H:i'),
                    'mine' => $currentUserId && $msg->user_id == $currentUserId,
                    'metadata' => $msg->metadata,
                ];
            });

            $displayName = $this->resolveRoomDisplayName($room, $currentUser, $currentUserId);

            return [
                'id' => $room->id,
                'name' => $displayName,
                'type' => $room->type === 'PROJECT_GROUP' ? 'group' : $room->type,
                'projectId' => $room->project_id,
                'unread' => $unreadCount,
                'online' => true,
                'participants' => $room->participants->map(fn($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'email' => $p->email,
                    'role' => $p->role,
                ])->values(),
                'messages' => $messages->values(),
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    /**
     * Get single chat room
     */
    public function show(Request $request, string $chatId): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        $currentUserId = $currentUser?->id;

        $room = ChatRoom::with(['participants', 'messages.sender'])->findOrFail($chatId);

        $participant = $room->participants->firstWhere('id', $currentUserId);
        if ($currentUserId && !$participant) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses ke percakapan ini (Privasi chat terlindungi).',
            ], 403);
        }

        $lastReadAt = $participant?->pivot?->last_read_at;

        $unreadCount = $room->messages
            ->where('user_id', '!=', $currentUserId)
            ->filter(fn($m) => !$lastReadAt || $m->created_at > $lastReadAt)
            ->count();

        $messages = $room->messages->map(function ($msg) use ($currentUserId) {
            return [
                'id' => (string) $msg->id,
                'sender' => $msg->sender?->name ?? 'User',
                'text' => $msg->message,
                'time' => $msg->created_at->format('H:i'),
                'mine' => $currentUserId && $msg->user_id == $currentUserId,
                'metadata' => $msg->metadata,
            ];
        });

        $displayName = $this->resolveRoomDisplayName($room, $currentUser, $currentUserId);

        return response()->json([
            'data' => [
                'id' => $room->id,
                'name' => $displayName,
                'type' => $room->type === 'PROJECT_GROUP' ? 'group' : $room->type,
                'projectId' => $room->project_id,
                'unread' => $unreadCount,
                'online' => true,
                'participants' => $room->participants->map(fn($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'email' => $p->email,
                    'role' => $p->role,
                ])->values(),
                'messages' => $messages->values(),
            ]
        ]);
    }

    /**
     * Resolve the display name of a room for the given user.
     * For 1-on-1 / direct chats, the room name should be the conversation partner's name.
     */
    private function resolveRoomDisplayName(ChatRoom $room, ?User $currentUser, $currentUserId): string
    {
        if ($room->type !== 'direct') {
            return $room->name;
        }

        $otherParticipants = $room->participants->filter(fn($p) => (string) $p->id !== (string) $currentUserId);

        if ($otherParticipants->isNotEmpty()) {
            $currentUserName = $currentUser?->name;
            $matchesCurrentUserName = $currentUserName && strcasecmp(trim($room->name), trim($currentUserName)) === 0;

            if ($matchesCurrentUserName || $room->participants->count() <= 2) {
                return $otherParticipants->first()->name;
            }

            $namedParticipant = $otherParticipants->first(fn($p) => strcasecmp(trim($p->name), trim($room->name)) === 0);
            return $namedParticipant ? $namedParticipant->name : $otherParticipants->first()->name;
        }

        return $room->name;
    }

    /**
     * Send message & parse #TASK-ID mentions for deep-linking
     * Emit WebSocket Event
     */
    public function sendMessage(Request $request, string $chatId): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $room = ChatRoom::with('participants')->findOrFail($chatId);
        if (!$room->participants->contains('id', $currentUser->id)) {
            return response()->json([
                'message' => 'Anda bukan peserta dalam percakapan ini (Privasi chat terlindungi).',
            ], 403);
        }

        // Parser mention #TASK-ID khusus jika di PROJECT_GROUP atau jika chat memiliki project_id
        $metadata = [];
        if ($room->project_id) {
            $parsed = TaskMentionParser::parse($request->message, $room->project_id);
            if (!empty($parsed['mentions'])) {
                $metadata = $parsed;
            }
        }

        $chatMessage = ChatMessage::create([
            'chat_room_id' => $room->id,
            'user_id' => $currentUser->id,
            'message' => $request->message,
            'metadata' => !empty($metadata) ? $metadata : null,
        ]);

        // Perbarui last_read_at pengirim
        ChatParticipant::updateOrCreate(
            ['chat_room_id' => $room->id, 'user_id' => $currentUser->id],
            ['last_read_at' => now()]
        );

        $chatMessage->load(['chatRoom.participants', 'sender']);

        // Simpan notifikasi ke database untuk seluruh partisipan selain pengirim
        foreach ($room->participants as $participant) {
            if ($participant->id !== $currentUser->id) {
                \App\Models\Notification::create([
                    'user_id' => $participant->id,
                    'title' => $currentUser->name . ($room->type === 'direct' ? '' : ' (' . $room->name . ')'),
                    'message' => $request->message,
                    'type' => 'CHAT_MESSAGE',
                    'data' => [
                        'chat_room_id' => $room->id,
                        'chat_room_name' => $room->name,
                        'sender_id' => $currentUser->id,
                        'sender_name' => $currentUser->name,
                    ],
                    'is_read' => false,
                ]);
            }
        }

        // Broadcast event via WebSocket
        try {
            broadcast(new ChatMessageSent($chatMessage));
        } catch (\Throwable $e) {
            // Log fallback jika server websocket belum berjalan
        }

        return response()->json([
            'data' => [
                'id' => (string) $chatMessage->id,
                'sender' => $currentUser->name,
                'text' => $chatMessage->message,
                'time' => $chatMessage->created_at->format('H:i'),
                'mine' => true,
                'metadata' => $chatMessage->metadata,
            ]
        ], 201);
    }

    /**
     * Mark chat room as read for current user
     */
    public function markAsRead(Request $request, string $chatId): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        ChatParticipant::updateOrCreate(
            ['chat_room_id' => $chatId, 'user_id' => $currentUser->id],
            ['last_read_at' => now()]
        );

        return response()->json(['message' => 'Room marked as read']);
    }
}
