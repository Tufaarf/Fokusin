<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\ChatRoom;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Endpoint GET /api/dashboard
     * Mengembalikan data agregasi:
     * 1. Calendar Events (range startDate - endDate, default 7 hari ke depan)
     * 2. Unfinished Tasks (status != 'done')
     * 3. Unreplied Chats (pesan terakhir bukan dari current user dan belum dibalas)
     * 4. Companion Priority Tasks (diurutkan berdasarkan algoritma skor urgensi)
     * 5. Ringkasan statistik mingguan
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user() ?? User::first();
        $currentUserId = $currentUser?->id;

        $startDate = $request->query('startDate', Carbon::today()->toDateString());
        $endDate = $request->query('endDate', Carbon::today()->addDays(7)->toDateString());

        // 1. Calendar Events dalam rentang tanggal
        $events = CalendarEvent::whereBetween('event_date', [$startDate, $endDate])
            ->when($currentUserId && !$currentUser?->isSuperAdmin(), function ($q) use ($currentUserId) {
                $q->where(function ($sub) use ($currentUserId) {
                    $sub->where('user_id', $currentUserId)
                        ->orWhereHas('project.members', fn($pm) => $pm->where('users.id', $currentUserId));
                });
            })
            ->orderBy('event_date', 'asc')
            ->orderBy('time', 'asc')
            ->get()
            ->map(function ($event) {
                return [
                    'id' => $event->id,
                    'title' => $event->title,
                    'date' => $event->event_date->toDateString(),
                    'endDate' => $event->end_date ? $event->end_date->toDateString() : null,
                    'time' => $event->time,
                    'type' => $event->type,
                    'projectId' => $event->project_id,
                ];
            });

        // 2. Daftar task yang belum selesai (status != 'DONE' / 'done')
        $unfinishedTasks = Task::with(['project', 'assignee', 'attachments'])
            ->whereNotIn('status', ['done', 'DONE'])
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(function ($task) {
                return [
                    'id' => $task->id,
                    'projectId' => $task->project_id,
                    'title' => $task->title,
                    'description' => $task->description,
                    'status' => strtolower($task->status),
                    'priority' => ucfirst($task->priority),
                    'dueDate' => $task->due_date ? $task->due_date->toISOString() : null,
                    'assignee' => $task->assignee_name ?? ($task->assignee?->name ?? 'Unassigned'),
                    'tags' => $task->tags ?? [],
                    'attachments' => $task->attachments->map(fn($a) => [
                        'name' => $a->name,
                        'type' => $a->file_type,
                        'url' => $a->url,
                    ]),
                ];
            });

        // 3. Algoritma Companion: Query pengurutan task aktif berdasarkan skor urgensi
        // Skor Urgensi menggabungkan bobot prioritas dan selisih jam ke due_date:
        // Prioritas: High = 100, Medium = 50, Low = 20
        // Overdue (selisih jam < 0): urgency meningkat tajam (+500 + abs(jam)*3)
        // Mendekati deadline: score = (bobot * 10) - (jam * 1.5)
        $companionTasks = Task::with(['project', 'assignee', 'attachments'])
            ->whereNotIn('status', ['done', 'DONE'])
            ->select('tasks.*')
            ->selectRaw("
                CASE 
                    WHEN due_date IS NULL THEN 
                        (CASE LOWER(priority) WHEN 'high' THEN 100 WHEN 'medium' THEN 50 ELSE 20 END)
                    WHEN TIMESTAMPDIFF(HOUR, NOW(), due_date) < 0 THEN 
                        ((CASE LOWER(priority) WHEN 'high' THEN 100 WHEN 'medium' THEN 50 ELSE 20 END) * 2) 
                        + (ABS(TIMESTAMPDIFF(HOUR, NOW(), due_date)) * 3) + 500
                    ELSE 
                        GREATEST(0, ((CASE LOWER(priority) WHEN 'high' THEN 100 WHEN 'medium' THEN 50 ELSE 20 END) * 10) 
                        - (TIMESTAMPDIFF(HOUR, NOW(), due_date) * 1.5))
                END AS computed_urgency_score
            ")
            ->orderByDesc('computed_urgency_score')
            ->limit(10)
            ->get()
            ->map(function ($task) {
                $hoursDiff = $task->due_date ? Carbon::now()->diffInHours($task->due_date, false) : null;
                $insight = "Prioritas {$task->priority}";
                if ($hoursDiff !== null) {
                    if ($hoursDiff < 0) {
                        $insight = "TERLAMBAT " . abs($hoursDiff) . " jam! Tindakan segera diperlukan.";
                    } elseif ($hoursDiff <= 24) {
                        $insight = "Deadline dalam {$hoursDiff} jam ke depan.";
                    } else {
                        $days = ceil($hoursDiff / 24);
                        $insight = "Deadline {$days} hari lagi.";
                    }
                }

                return [
                    'id' => $task->id,
                    'projectId' => $task->project_id,
                    'title' => $task->title,
                    'description' => $task->description,
                    'status' => strtolower($task->status),
                    'priority' => ucfirst($task->priority),
                    'dueDate' => $task->due_date ? $task->due_date->toISOString() : null,
                    'assignee' => $task->assignee_name ?? ($task->assignee?->name ?? 'Unassigned'),
                    'tags' => $task->tags ?? [],
                    'urgency_score' => round((float) $task->computed_urgency_score, 2),
                    'companion_insight' => $insight,
                ];
            });

        // 4. Daftar ruang chat di mana pesan terakhir bukan dari user yang sedang login dan belum dibalas/dibaca
        $chatRooms = ChatRoom::with(['participants', 'messages' => fn($q) => $q->latest()->limit(1)])
            ->when($currentUserId, function ($q) use ($currentUserId) {
                $q->whereHas('participants', fn($p) => $p->where('users.id', $currentUserId));
            })
            ->get();

        $unrepliedChats = [];

        foreach ($chatRooms as $room) {
            $latestMsg = $room->messages->first();
            if (!$latestMsg) {
                continue;
            }

            // Cek apakah pengirim pesan terakhir BUKAN user yang login
            if ($currentUserId && $latestMsg->user_id == $currentUserId) {
                continue;
            }

            // Hitung unread untuk user ini
            $participant = $room->participants->firstWhere('id', $currentUserId);
            $lastReadAt = $participant?->pivot?->last_read_at;

            $unreadCount = $room->messages()
                ->where('user_id', '!=', $currentUserId)
                ->when($lastReadAt, fn($q) => $q->where('created_at', '>', $lastReadAt))
                ->count();

            // Tentukan nama tampilan untuk direct chat (lawan bicara)
            $displayName = $room->name;
            if ($room->type === 'direct') {
                $otherParticipants = $room->participants->filter(fn($p) => (string) $p->id !== (string) $currentUserId);
                if ($otherParticipants->isNotEmpty()) {
                    $currentUserName = $currentUser?->name;
                    $matchesCurrentUserName = $currentUserName && strcasecmp(trim($room->name), trim($currentUserName)) === 0;

                    if ($matchesCurrentUserName || $room->participants->count() <= 2) {
                        $displayName = $otherParticipants->first()->name;
                    } else {
                        $namedParticipant = $otherParticipants->first(fn($p) => strcasecmp(trim($p->name), trim($room->name)) === 0);
                        $displayName = $namedParticipant ? $namedParticipant->name : $otherParticipants->first()->name;
                    }
                }
            }

            // Jika ada pesan belum dibalas atau unread > 0
            $unrepliedChats[] = [
                'id' => $room->id,
                'name' => $displayName,
                'type' => $room->type === 'PROJECT_GROUP' ? 'group' : $room->type,
                'projectId' => $room->project_id,
                'unread' => max(1, $unreadCount),
                'last_message' => [
                    'id' => (string) $latestMsg->id,
                    'sender' => $latestMsg->sender?->name ?? 'Anggota',
                    'text' => $latestMsg->message,
                    'time' => $latestMsg->created_at->format('H:i'),
                ],
            ];
        }

        // 5. Ringkasan produktivitas
        $startOfWeek = Carbon::now()->startOfWeek();
        $endOfWeek = Carbon::now()->endOfWeek();

        $doneThisWeek = Task::whereIn('status', ['done', 'DONE'])
            ->whereBetween('updated_at', [$startOfWeek, $endOfWeek])
            ->count();

        $totalActiveTasks = Task::whereNotIn('status', ['done', 'DONE'])->count();

        return response()->json([
            'events' => $events,
            'unfinished_tasks' => $unfinishedTasks,
            'companion_tasks' => $companionTasks,
            'unreplied_chats' => $unrepliedChats,
            'summary' => [
                'done_this_week' => $doneThisWeek,
                'total_active_tasks' => $totalActiveTasks,
            ],
        ]);
    }
}
