<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatParticipant;
use App\Models\ChatRoom;
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
                'members' => $proj->members->pluck('email')->toArray(),
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
                'members' => $project->members->pluck('email')->toArray(),
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

            return response()->json([
                'message' => 'Proyek dan Group Chat berhasil dibuat secara atomik.',
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'color' => $project->color,
                    'members' => $allEmails->toArray(),
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
}
