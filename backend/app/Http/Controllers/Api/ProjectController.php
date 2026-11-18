<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatParticipant;
use App\Models\ChatRoom;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProjectController extends Controller
{
    /**
     * List all projects.
     * Superadmin can see all projects across all users.
     * Regular users can only see projects where they are creator or member.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Project::with(['members', 'creator']);

        if ($user && !$user->isSuperAdmin()) {
            $query->where(function ($sub) use ($user) {
                $sub->where('created_by', $user->id)
                    ->orWhereHas('members', fn($q) => $q->where('users.id', $user->id));
            });
        }

        $projects = $query->latest()->get();

        $formatted = $projects->map(function ($proj) {
            return [
                'id' => $proj->id,
                'name' => $proj->name,
                'color' => $proj->color,
                'description' => $proj->description,
                'created_by' => $proj->created_by,
                'members' => $proj->members->pluck('email')->toArray(),
                'member_details' => $proj->members->map(function ($m) use ($proj) {
                    return [
                        'id' => $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'avatar' => $m->avatar,
                        'role' => $m->pivot?->role ?? ($m->id === $proj->created_by ? 'owner' : 'member'),
                    ];
                })->values(),
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    /**
     * Show single project details
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $query = Project::with(['members', 'tasks', 'chatRoom']);

        if ($user && !$user->isSuperAdmin()) {
            $query->where(function ($sub) use ($user) {
                $sub->where('created_by', $user->id)
                    ->orWhereHas('members', fn($q) => $q->where('users.id', $user->id));
            });
        }

        $project = $query->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $project->id,
                'name' => $project->name,
                'color' => $project->color,
                'description' => $project->description,
                'created_by' => $project->created_by,
                'members' => $project->members->pluck('email')->toArray(),
                'member_details' => $project->members->map(function ($m) use ($project) {
                    return [
                        'id' => $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'avatar' => $m->avatar,
                        'role' => $m->pivot?->role ?? ($m->id === $project->created_by ? 'owner' : 'member'),
                    ];
                })->values(),
                'tasks' => $project->tasks,
                'chat_room' => $project->chatRoom,
            ]
        ]);
    }

    /**
     * Database Transaction — Auto Create Group Chat
     *
     * Atomik:
     * 1. Buat data Project
     * 2. Validasi dan masukkan anggota ke ProjectMembers
     * 3. Otomatis buat ChatRoom bertipe PROJECT_GROUP dengan nama yang sama dan masukkan seluruh anggota ke ChatParticipants
     * Jika salah satu gagal -> Rollback seluruh transaksi.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:30',
            'description' => 'nullable|string',
            'member_emails' => 'nullable|array',
            'member_emails.*' => 'required|email',
        ]);

        $currentUser = $request->user() ?? User::first();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthenticated or user not found'], 401);
        }

        // Mulai Database Transaction secara ketat
        DB::beginTransaction();

        try {
            // (1) Generate unique Project ID & create Project record
            $baseSlug = Str::slug($validated['name']);
            $projectId = $baseSlug ?: 'proj-' . Str::random(6);

            // Cek collision ID
            if (Project::where('id', $projectId)->exists()) {
                $projectId = $projectId . '-' . Str::lower(Str::random(4));
            }

            $project = Project::create([
                'id' => $projectId,
                'name' => $validated['name'],
                'color' => $validated['color'] ?? '#059669',
                'description' => $validated['description'] ?? null,
                'created_by' => $currentUser->id,
            ]);

            // Kumpulkan email anggota (sertakan pembuat proyek secara otomatis)
            $inputEmails = collect($validated['member_emails'] ?? []);
            $allEmails = $inputEmails->push($currentUser->email)->unique()->values();

            // (2) Memvalidasi dan memasukkan anggota ke ProjectMembers
            $resolvedUserIds = [];

            foreach ($allEmails as $email) {
                // Validasi eksistensi user di database
                $memberUser = User::where('email', $email)->first();

                if (!$memberUser) {
                    // Jika salah satu email tidak valid / belum terdaftar, batalkan proses
                    throw ValidationException::withMessages([
                        'member_emails' => "Anggota dengan email [{$email}] belum terdaftar di sistem. Transaksi dibatalkan."
                    ]);
                }

                $role = ($memberUser->id === $currentUser->id) ? 'owner' : 'member';

                ProjectMember::create([
                    'project_id' => $project->id,
                    'user_id' => $memberUser->id,
                    'role' => $role,
                ]);

                $resolvedUserIds[] = $memberUser->id;
            }

            // (3) Otomatis membuat ChatRoom bertipe PROJECT_GROUP dengan nama yang sama
            $chatRoomId = 'chat-' . $project->id;
            $chatRoom = ChatRoom::create([
                'id' => $chatRoomId,
                'name' => $project->name,
                'type' => 'PROJECT_GROUP',
                'project_id' => $project->id,
                'created_by' => $currentUser->id,
            ]);

            // Masukkan seluruh anggota proyek ke ChatParticipants
            foreach ($resolvedUserIds as $userId) {
                ChatParticipant::create([
                    'chat_room_id' => $chatRoom->id,
                    'user_id' => $userId,
                    'last_read_at' => now(),
                ]);
            }

            // Jika seluruh tahap sukses, lakukan commit atomik
            DB::commit();

            $project->load('members');

            return response()->json([
                'message' => 'Proyek dan Group Chat berhasil dibuat secara atomik.',
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'color' => $project->color,
                    'description' => $project->description,
                    'created_by' => $project->created_by,
                    'members' => $allEmails->toArray(),
                    'member_details' => $project->members->map(fn($m) => [
                        'id' => $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'avatar' => $m->avatar,
                        'role' => $m->pivot?->role ?? ($m->id === $project->created_by ? 'owner' : 'member'),
                    ])->values(),
                ],
                'chat_room' => [
                    'id' => $chatRoom->id,
                    'name' => $chatRoom->name,
                    'type' => 'group',
                    'projectId' => $project->id,
                    'unread' => 0,
                    'messages' => [],
                ]
            ], 201);

        } catch (\Throwable $e) {
            // Batalkan seluruh proses jika terjadi kesalahan apapun
            DB::rollBack();

            if ($e instanceof ValidationException) {
                return response()->json([
                    'message' => 'Validasi gagal, transaksi pembuatan proyek dibatalkan.',
                    'errors' => $e->errors(),
                ], 422);
            }

            return response()->json([
                'message' => 'Gagal membuat proyek: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Add member(s) to an existing project.
     * Synchronizes ProjectMember, ChatRoom ChatParticipant, and sends Notification.
     */
    public function addMember(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'nullable|email',
            'user_id' => 'nullable|exists:users,id',
            'emails' => 'nullable|array',
            'emails.*' => 'required|email',
            'role' => 'nullable|string|in:member,admin,owner',
        ]);

        $currentUser = $request->user();
        $project = Project::with(['members', 'chatRoom'])->findOrFail($id);

        // Authorization check: User must be creator, project member, or superadmin
        if ($currentUser && !$currentUser->isSuperAdmin()) {
            $isMemberOrOwner = $project->created_by === $currentUser->id ||
                $project->members->contains('id', $currentUser->id);
            if (!$isMemberOrOwner) {
                return response()->json(['message' => 'Anda tidak memiliki hak untuk menambah anggota di project ini.'], 403);
            }
        }

        $emailsToAdd = collect($validated['emails'] ?? []);
        if (!empty($validated['email'])) {
            $emailsToAdd->push($validated['email']);
        }

        $userIdsToAdd = collect();
        if (!empty($validated['user_id'])) {
            $userIdsToAdd->push($validated['user_id']);
        }

        if ($emailsToAdd->isEmpty() && $userIdsToAdd->isEmpty()) {
            return response()->json(['message' => 'Email atau ID anggota harus disertakan.'], 422);
        }

        DB::beginTransaction();
        try {
            // Handle user_ids
            foreach ($userIdsToAdd->unique() as $uid) {
                $user = User::find($uid);
                if (!$user) continue;

                if ($project->members->contains('id', $user->id)) {
                    continue;
                }

                ProjectMember::create([
                    'project_id' => $project->id,
                    'user_id' => $user->id,
                    'role' => $validated['role'] ?? 'member',
                ]);

                if ($project->chatRoom) {
                    ChatParticipant::firstOrCreate([
                        'chat_room_id' => $project->chatRoom->id,
                        'user_id' => $user->id,
                    ], [
                        'last_read_at' => now(),
                    ]);
                }

                Notification::create([
                    'user_id' => $user->id,
                    'title' => 'Ditambahkan ke Project',
                    'message' => "Anda telah ditambahkan ke dalam project \"{$project->name}\".",
                    'type' => 'project_member',
                    'data' => [
                        'project_id' => $project->id,
                        'project_name' => $project->name,
                        'added_by' => $currentUser?->name ?? 'Admin',
                    ],
                    'is_read' => false,
                ]);
            }

            // Handle emails
            foreach ($emailsToAdd->unique() as $email) {
                $user = User::where('email', $email)->first();
                if (!$user) {
                    throw ValidationException::withMessages([
                        'email' => "User dengan email [{$email}] belum terdaftar di sistem Fokusin.",
                    ]);
                }

                if ($project->members->contains('id', $user->id)) {
                    if ($emailsToAdd->count() === 1 && $userIdsToAdd->isEmpty()) {
                        throw ValidationException::withMessages([
                            'email' => "User [{$email}] sudah menjadi anggota project ini.",
                        ]);
                    }
                    continue;
                }

                ProjectMember::create([
                    'project_id' => $project->id,
                    'user_id' => $user->id,
                    'role' => $validated['role'] ?? 'member',
                ]);

                if ($project->chatRoom) {
                    ChatParticipant::firstOrCreate([
                        'chat_room_id' => $project->chatRoom->id,
                        'user_id' => $user->id,
                    ], [
                        'last_read_at' => now(),
                    ]);
                }

                Notification::create([
                    'user_id' => $user->id,
                    'title' => 'Ditambahkan ke Project',
                    'message' => "Anda telah ditambahkan ke dalam project \"{$project->name}\".",
                    'type' => 'project_member',
                    'data' => [
                        'project_id' => $project->id,
                        'project_name' => $project->name,
                        'added_by' => $currentUser?->name ?? 'Admin',
                    ],
                    'is_read' => false,
                ]);
            }

            DB::commit();

            $project->load(['members', 'chatRoom']);

            return response()->json([
                'message' => 'Anggota berhasil ditambahkan ke project.',
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'color' => $project->color,
                    'description' => $project->description,
                    'created_by' => $project->created_by,
                    'members' => $project->members->pluck('email')->toArray(),
                    'member_details' => $project->members->map(fn($m) => [
                        'id' => $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'avatar' => $m->avatar,
                        'role' => $m->pivot?->role ?? ($m->id === $project->created_by ? 'owner' : 'member'),
                    ])->values(),
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            if ($e instanceof ValidationException) {
                return response()->json([
                    'message' => 'Validasi gagal.',
                    'errors' => $e->errors(),
                ], 422);
            }

            return response()->json([
                'message' => 'Gagal menambahkan anggota: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove member from an existing project.
     * Synchronizes ProjectMember and ChatRoom ChatParticipant.
     */
    public function removeMember(Request $request, string $id, string $memberId): JsonResponse
    {
        $currentUser = $request->user();
        $project = Project::with(['members', 'chatRoom'])->findOrFail($id);

        $targetUser = is_numeric($memberId)
            ? User::find($memberId)
            : User::where('email', $memberId)->first();

        if (!$targetUser) {
            return response()->json(['message' => 'User tidak ditemukan.'], 404);
        }

        // Check if user is the project owner/creator
        if ($project->created_by && $project->created_by === $targetUser->id) {
            return response()->json([
                'message' => 'Pemilik project (owner) tidak dapat dihapus dari anggota project.'
            ], 422);
        }

        // Authorization check: only project creator, superadmin, or self (leaving)
        if ($currentUser && !$currentUser->isSuperAdmin()) {
            $isOwner = $project->created_by === $currentUser->id;
            $isSelf = $currentUser->id === $targetUser->id;
            if (!$isOwner && !$isSelf) {
                return response()->json([
                    'message' => 'Hanya pemilik project atau Superadmin yang dapat menghapus anggota lain.'
                ], 403);
            }
        }

        DB::beginTransaction();
        try {
            ProjectMember::where('project_id', $project->id)
                ->where('user_id', $targetUser->id)
                ->delete();

            if ($project->chatRoom) {
                ChatParticipant::where('chat_room_id', $project->chatRoom->id)
                    ->where('user_id', $targetUser->id)
                    ->delete();
            }

            // Notification
            Notification::create([
                'user_id' => $targetUser->id,
                'title' => 'Dikeluarkan dari Project',
                'message' => "Anda telah dikeluarkan dari project \"{$project->name}\".",
                'type' => 'project_member_removed',
                'data' => [
                    'project_id' => $project->id,
                    'project_name' => $project->name,
                ],
                'is_read' => false,
            ]);

            DB::commit();

            $project->load('members');

            return response()->json([
                'message' => 'Anggota berhasil dihapus dari project.',
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'color' => $project->color,
                    'description' => $project->description,
                    'created_by' => $project->created_by,
                    'members' => $project->members->pluck('email')->toArray(),
                    'member_details' => $project->members->map(fn($m) => [
                        'id' => $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'avatar' => $m->avatar,
                        'role' => $m->pivot?->role ?? ($m->id === $project->created_by ? 'owner' : 'member'),
                    ])->values(),
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menghapus anggota: ' . $e->getMessage(),
            ], 500);
        }
    }
}
