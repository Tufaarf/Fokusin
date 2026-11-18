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
use Illuminate\Support\Str;

class ChatController extends Controller
{
    /**
     * Format a chat message for API responses with all WhatsApp-standard properties
     */
    private function formatMessage(ChatMessage $msg, $currentUserId): array
    {
        $meta = $msg->metadata ?? [];
        $isMine = $currentUserId && (string) $msg->user_id === (string) $currentUserId;
        $isDeleted = !empty($meta['is_deleted']);
        $starredBy = $meta['starred_by'] ?? [];

        // Normalize reactions
        $reactions = [];
        if (!empty($meta['reactions']) && is_array($meta['reactions'])) {
            foreach ($meta['reactions'] as $item) {
                if (!empty($item['emoji']) && !empty($item['users'])) {
                    $reactions[] = [
                        'emoji' => $item['emoji'],
                        'count' => count($item['users']),
                        'users' => $item['users'],
                    ];
                }
            }
        }

        return [
            'id' => (string) $msg->id,
            'sender' => $msg->sender?->name ?? 'User',
            'senderId' => $msg->user_id,
            'text' => $isDeleted ? 'Pesan ini telah dihapus' : $msg->message,
            'time' => $msg->created_at ? $msg->created_at->format('H:i') : date('H:i'),
            'mine' => (bool) $isMine,
            'status' => 'read',
            'isDeleted' => (bool) $isDeleted,
            'deletedForEveryone' => !empty($meta['deleted_for_everyone']),
            'isEdited' => !empty($meta['is_edited']),
            'editedAt' => $meta['edited_at'] ?? null,
            'isForwarded' => !empty($meta['is_forwarded']),
            'replyTo' => $meta['reply_to'] ?? null,
            'reactions' => $reactions,
            'isPinned' => !empty($meta['is_pinned']),
            'isStarred' => in_array($currentUserId, $starredBy),
            'metadata' => $meta,
        ];
    }

    /**
     * Check if message was deleted for the given user ("Hapus untuk saya")
     */
    private function isDeletedForUser(ChatMessage $msg, $currentUserId): bool
    {
        $meta = $msg->metadata ?? [];
        $deletedForUsers = $meta['deleted_for_users'] ?? [];
        return in_array($currentUserId, $deletedForUsers);
    }

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

            $messages = $room->messages
                ->filter(fn($msg) => !$this->isDeletedForUser($msg, $currentUserId))
                ->map(fn($msg) => $this->formatMessage($msg, $currentUserId));

            $displayName = $this->resolveRoomDisplayName($room, $currentUser, $currentUserId);

            // Find pinned message in this room if any
            $pinnedMsg = $messages->firstWhere('isPinned', true);

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
                'pinnedMessage' => $pinnedMsg ?? null,
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

        $messages = $room->messages
            ->filter(fn($msg) => !$this->isDeletedForUser($msg, $currentUserId))
            ->map(fn($msg) => $this->formatMessage($msg, $currentUserId));

        $displayName = $this->resolveRoomDisplayName($room, $currentUser, $currentUserId);
        $pinnedMsg = $messages->firstWhere('isPinned', true);

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
                'pinnedMessage' => $pinnedMsg ?? null,
                'messages' => $messages->values(),
            ]
        ]);
    }

    /**
     * Resolve the display name of a room for the given user.
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
            'reply_to_id' => 'nullable|string',
            'is_forwarded' => 'nullable|boolean',
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

        $metadata = [];
        if ($room->project_id) {
            $parsed = TaskMentionParser::parse($request->message, $room->project_id);
            if (!empty($parsed['mentions'])) {
                $metadata = $parsed;
            }
        }

        // Attach quote reply preview if requested
        if ($request->filled('reply_to_id')) {
            $replyMsg = ChatMessage::with('sender')->find($request->reply_to_id);
            if ($replyMsg) {
                $metadata['reply_to'] = [
                    'id' => (string) $replyMsg->id,
                    'sender' => $replyMsg->sender?->name ?? 'User',
                    'text' => Str::limit($replyMsg->message, 120),
                ];
            }
        }

        if ($request->boolean('is_forwarded')) {
            $metadata['is_forwarded'] = true;
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
            'data' => $this->formatMessage($chatMessage, $currentUser->id)
        ], 201);
    }

    /**
     * Edit an existing message (Owner only)
     */
    public function editMessage(Request $request, string $chatId, string $messageId): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $room = ChatRoom::findOrFail($chatId);
        $message = ChatMessage::with('sender')->where('chat_room_id', $room->id)->findOrFail($messageId);

        if ((string) $message->user_id !== (string) $currentUser->id) {
            return response()->json(['message' => 'Anda hanya dapat mengedit pesan yang Anda kirim sendiri.'], 403);
        }

        $meta = $message->metadata ?? [];
        if (!empty($meta['is_deleted'])) {
            return response()->json(['message' => 'Pesan yang sudah dihapus tidak dapat diedit.'], 400);
        }

        $meta['is_edited'] = true;
        $meta['edited_at'] = now()->toIso8601String();

        // Reparse task mentions if group has project_id
        if ($room->project_id) {
            $parsed = TaskMentionParser::parse($request->message, $room->project_id);
            if (!empty($parsed['mentions'])) {
                $meta['mentions'] = $parsed['mentions'];
            }
        }

        $message->message = $request->message;
        $message->metadata = $meta;
        $message->save();

        return response()->json([
            'message' => 'Pesan berhasil diperbarui',
            'data' => $this->formatMessage($message, $currentUser->id),
        ]);
    }

    /**
     * Delete message (Delete for everyone or Delete for me)
     */
    public function deleteMessage(Request $request, string $chatId, string $messageId): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $room = ChatRoom::findOrFail($chatId);
        $message = ChatMessage::with('sender')->where('chat_room_id', $room->id)->findOrFail($messageId);

        $forEveryone = $request->boolean('for_everyone', false);
        $meta = $message->metadata ?? [];

        if ($forEveryone) {
            // Only message owner or superadmin can delete for everyone
            $isOwner = (string) $message->user_id === (string) $currentUser->id;
            $isSuperAdmin = $currentUser->role === 'superadmin' || !empty($currentUser->is_superadmin);

            if (!$isOwner && !$isSuperAdmin) {
                return response()->json(['message' => 'Hanya pengirim yang dapat menghapus pesan untuk semua orang.'], 403);
            }

            $meta['is_deleted'] = true;
            $meta['deleted_for_everyone'] = true;
            $meta['deleted_at'] = now()->toIso8601String();
            $message->message = 'Pesan ini telah dihapus';
            $message->metadata = $meta;
            $message->save();
        } else {
            // Delete for me
            $deletedFor = $meta['deleted_for_users'] ?? [];
            if (!in_array($currentUser->id, $deletedFor)) {
                $deletedFor[] = $currentUser->id;
            }
            $meta['deleted_for_users'] = array_values(array_unique($deletedFor));
            $message->metadata = $meta;
            $message->save();
        }

        return response()->json([
            'message' => 'Pesan berhasil dihapus',
            'for_everyone' => $forEveryone,
            'data' => $this->formatMessage($message, $currentUser->id),
        ]);
    }

    /**
     * Toggle emoji reaction on message (WhatsApp style: 👍, ❤️, 😂, 😮, 😢, 🙏)
     */
    public function toggleReaction(Request $request, string $chatId, string $messageId): JsonResponse
    {
        $request->validate([
            'emoji' => 'required|string|max:16',
        ]);

        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $room = ChatRoom::findOrFail($chatId);
        $message = ChatMessage::with('sender')->where('chat_room_id', $room->id)->findOrFail($messageId);

        $meta = $message->metadata ?? [];
        $reactions = $meta['reactions'] ?? [];
        $targetEmoji = $request->emoji;
        $userName = $currentUser->name;

        // Check if user has already reacted with any emoji
        $alreadyHasEmoji = false;
        foreach ($reactions as $key => $r) {
            if (in_array($userName, $r['users'] ?? [])) {
                // remove user from previous reaction
                $r['users'] = array_values(array_filter($r['users'], fn($u) => $u !== $userName));
                if ($r['emoji'] === $targetEmoji) {
                    $alreadyHasEmoji = true; // Was the same emoji, so toggle off
                }
                $reactions[$key] = $r;
            }
        }

        // If it wasn't the same emoji, add user to target emoji
        if (!$alreadyHasEmoji) {
            $foundEmojiKey = null;
            foreach ($reactions as $key => $r) {
                if ($r['emoji'] === $targetEmoji) {
                    $foundEmojiKey = $key;
                    break;
                }
            }

            if ($foundEmojiKey !== null) {
                $reactions[$foundEmojiKey]['users'][] = $userName;
            } else {
                $reactions[] = [
                    'emoji' => $targetEmoji,
                    'users' => [$userName],
                ];
            }
        }

        // Filter out empty reactions
        $reactions = array_values(array_filter($reactions, fn($r) => !empty($r['users'])));

        $meta['reactions'] = $reactions;
        $message->metadata = $meta;
        $message->save();

        return response()->json([
            'message' => 'Reaksi diperbarui',
            'data' => $this->formatMessage($message, $currentUser->id),
        ]);
    }

    /**
     * Toggle pinned message in chat room
     */
    public function togglePin(Request $request, string $chatId, string $messageId): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $room = ChatRoom::findOrFail($chatId);
        $message = ChatMessage::with('sender')->where('chat_room_id', $room->id)->findOrFail($messageId);

        $meta = $message->metadata ?? [];
        $isCurrentlyPinned = !empty($meta['is_pinned']);

        if (!$isCurrentlyPinned) {
            // Unpin any other pinned message in this room first
            $otherPinned = ChatMessage::where('chat_room_id', $room->id)->get();
            foreach ($otherPinned as $other) {
                $otherMeta = $other->metadata ?? [];
                if (!empty($otherMeta['is_pinned'])) {
                    $otherMeta['is_pinned'] = false;
                    $other->metadata = $otherMeta;
                    $other->save();
                }
            }

            $meta['is_pinned'] = true;
            $meta['pinned_at'] = now()->toIso8601String();
            $meta['pinned_by'] = $currentUser->name;
        } else {
            $meta['is_pinned'] = false;
        }

        $message->metadata = $meta;
        $message->save();

        return response()->json([
            'message' => $meta['is_pinned'] ? 'Pesan disematkan' : 'Sematan pesan dilepas',
            'isPinned' => $meta['is_pinned'],
            'data' => $this->formatMessage($message, $currentUser->id),
        ]);
    }

    /**
     * Toggle starred message for current user
     */
    public function toggleStar(Request $request, string $chatId, string $messageId): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $room = ChatRoom::findOrFail($chatId);
        $message = ChatMessage::with('sender')->where('chat_room_id', $room->id)->findOrFail($messageId);

        $meta = $message->metadata ?? [];
        $starredBy = $meta['starred_by'] ?? [];

        if (in_array($currentUser->id, $starredBy)) {
            $starredBy = array_values(array_filter($starredBy, fn($id) => $id !== $currentUser->id));
            $isStarred = false;
        } else {
            $starredBy[] = $currentUser->id;
            $isStarred = true;
        }

        $meta['starred_by'] = $starredBy;
        $message->metadata = $meta;
        $message->save();

        return response()->json([
            'message' => $isStarred ? 'Pesan dibintangi' : 'Bintang pesan dihapus',
            'isStarred' => $isStarred,
            'data' => $this->formatMessage($message, $currentUser->id),
        ]);
    }

    /**
     * Forward message to one or more chat rooms
     */
    public function forwardMessage(Request $request, string $chatId): JsonResponse
    {
        $request->validate([
            'target_room_ids' => 'required|array|min:1',
            'text' => 'required|string|max:5000',
        ]);

        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $createdMessages = [];
        foreach ($request->target_room_ids as $targetId) {
            $room = ChatRoom::with('participants')->find($targetId);
            if (!$room || !$room->participants->contains('id', $currentUser->id)) {
                continue;
            }

            $meta = ['is_forwarded' => true];
            $chatMessage = ChatMessage::create([
                'chat_room_id' => $room->id,
                'user_id' => $currentUser->id,
                'message' => $request->text,
                'metadata' => $meta,
            ]);

            ChatParticipant::updateOrCreate(
                ['chat_room_id' => $room->id, 'user_id' => $currentUser->id],
                ['last_read_at' => now()]
            );

            $chatMessage->load(['chatRoom.participants', 'sender']);

            try {
                broadcast(new ChatMessageSent($chatMessage));
            } catch (\Throwable $e) {}

            $createdMessages[] = $this->formatMessage($chatMessage, $currentUser->id);
        }

        return response()->json([
            'message' => 'Pesan berhasil diteruskan',
            'data' => $createdMessages,
        ]);
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
