<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatParticipant;
use App\Models\ChatRoom;
use App\Models\Friend;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FriendController extends Controller
{
    /**
     * Add friend by email and automatically initiate direct chat room
     */
    public function addFriend(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $friendUser = User::where('email', $request->email)->first();

        if (!$friendUser) {
            return response()->json(['message' => "User dengan email {$request->email} tidak ditemukan."], 404);
        }

        if ($friendUser->id === $currentUser->id) {
            return response()->json(['message' => 'Tidak dapat menambahkan diri sendiri sebagai teman.'], 422);
        }

        Friend::firstOrCreate([
            'user_id' => $currentUser->id,
            'friend_id' => $friendUser->id,
        ]);

        Friend::firstOrCreate([
            'user_id' => $friendUser->id,
            'friend_id' => $currentUser->id,
        ]);

        // Cek atau buat direct ChatRoom antar kedua user
        $existingRoom = ChatRoom::where('type', 'direct')
            ->whereHas('participants', fn($q) => $q->where('users.id', $currentUser->id))
            ->whereHas('participants', fn($q) => $q->where('users.id', $friendUser->id))
            ->first();

        if (!$existingRoom) {
            $roomId = 'chat-' . Str::slug($friendUser->name) . '-' . Str::lower(Str::random(4));
            $existingRoom = ChatRoom::create([
                'id' => $roomId,
                'name' => $friendUser->name,
                'type' => 'direct',
                'created_by' => $currentUser->id,
            ]);

            ChatParticipant::create([
                'chat_room_id' => $existingRoom->id,
                'user_id' => $currentUser->id,
                'last_read_at' => now(),
            ]);

            ChatParticipant::create([
                'chat_room_id' => $existingRoom->id,
                'user_id' => $friendUser->id,
                'last_read_at' => now(),
            ]);
        }

        return response()->json([
            'message' => 'Teman berhasil ditambahkan',
            'chat_room' => [
                'id' => $existingRoom->id,
                'name' => $friendUser->name,
                'type' => 'direct',
                'unread' => 0,
                'online' => true,
                'participants' => [
                    ['id' => $currentUser->id, 'name' => $currentUser->name, 'email' => $currentUser->email],
                    ['id' => $friendUser->id, 'name' => $friendUser->name, 'email' => $friendUser->email],
                ],
                'messages' => [],
            ]
        ]);
    }

    /**
     * Search friends / users
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->query('q', '');

        $users = User::where('name', 'like', "%{$query}%")
            ->orWhere('email', 'like', "%{$query}%")
            ->limit(10)
            ->get(['id', 'name', 'email', 'avatar']);

        return response()->json(['data' => $users]);
    }
}
