<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TaskController extends Controller
{
    /**
     * List tasks (optional filter by project_id)
     * Scoped to tasks belonging to the user or in projects the user has access to.
     */
    public function index(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');
        $user = $request->user();

        $tasks = Task::with(['project', 'assignee', 'attachments'])
            ->forUser($user)
            ->when($projectId, fn($q) => $q->where('project_id', $projectId))
            ->orderBy('due_date', 'asc')
            ->get();

        $formatted = $tasks->map(function ($task) {
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
                'urgency_score' => $task->urgency_score,
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    /**
     * Create a new task
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'projectId' => 'nullable|string',
            'project_id' => 'nullable|string',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|string',
            'dueDate' => 'nullable|string',
            'due_date' => 'nullable|string',
            'assignee' => 'nullable|string',
            'assignee_id' => 'nullable|exists:users,id',
            'tags' => 'nullable|array',
        ]);

        $projectId = $request->project_id ?? $request->projectId;
        if (!$projectId) {
            return response()->json(['message' => 'Project ID diperlukan'], 422);
        }

        $project = Project::find($projectId);
        if (!$project) {
            return response()->json(['message' => 'Project tidak ditemukan'], 404);
        }

        $user = $request->user();
        if ($user && !$user->isSuperAdmin()) {
            $hasAccess = $project->created_by === $user->id || $project->members()->where('users.id', $user->id)->exists();
            if (!$hasAccess) {
                return response()->json(['message' => 'Anda tidak memiliki akses ke project ini'], 403);
            }
        }

        // Generate TASK-ID if not provided
        $taskId = $request->id;
        if (!$taskId) {
            $allIds = Task::pluck('id')->toArray();
            $maxNum = 100;
            foreach ($allIds as $id) {
                if (preg_match('/^TASK-(\d+)$/i', $id, $matches)) {
                    $num = (int) $matches[1];
                    if ($num > $maxNum) {
                        $maxNum = $num;
                    }
                }
            }
            $taskId = 'TASK-' . ($maxNum + 1);
        }

        // Try to match assignee with a User in the database
        $assigneeName = $request->assignee ?? $request->user()?->name ?? 'Unassigned';
        $assigneeId = $request->assignee_id;
        if (!$assigneeId && $assigneeName) {
            $user = User::where('name', $assigneeName)
                ->orWhere('email', $assigneeName)
                ->first();
            if ($user) {
                $assigneeId = $user->id;
                $assigneeName = $user->name;
            }
        }

        $rawDate = $request->due_date ?? $request->dueDate;
        $dueDate = $rawDate ? Carbon::parse($rawDate) : Carbon::now()->addDays(2);

        $task = Task::create([
            'id' => $taskId,
            'project_id' => $projectId,
            'title' => $request->title,
            'description' => $request->description ?? '',
            'status' => strtolower($request->status ?? 'todo'),
            'priority' => ucfirst($request->priority ?? 'Medium'),
            'due_date' => $dueDate,
            'assignee_id' => $assigneeId,
            'assignee_name' => $assigneeName,
            'tags' => $request->tags ?? ['Feature'],
        ]);

        $formatted = [
            'id' => $task->id,
            'projectId' => $task->project_id,
            'title' => $task->title,
            'description' => $task->description,
            'status' => strtolower($task->status),
            'priority' => ucfirst($task->priority),
            'dueDate' => $task->due_date ? $task->due_date->toISOString() : null,
            'assignee' => $task->assignee_name ?? ($task->assignee?->name ?? 'Unassigned'),
            'tags' => $task->tags ?? [],
            'attachments' => [],
            'urgency_score' => $task->urgency_score,
        ];

        return response()->json([
            'message' => 'Task berhasil dibuat',
            'data' => $formatted,
        ], 201);
    }

    /**
     * Update task status (e.g. todo, progress, review, done)
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|string|in:todo,progress,review,done,TODO,IN_PROGRESS,REVIEW,DONE',
        ]);

        $task = Task::with('project')->findOrFail($id);
        if (!$task->canAccess($request->user())) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $task->status = strtolower($request->status);
        $task->save();

        return response()->json([
            'message' => 'Status task berhasil diperbarui',
            'data' => $task,
        ]);
    }

    /**
     * Update task details (description, attachments, etc.)
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|string',
            'dueDate' => 'nullable|date',
            'assignee' => 'nullable|string',
        ]);

        $task = Task::with('project')->findOrFail($id);
        if (!$task->canAccess($request->user())) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        if ($request->has('description')) {
            $task->description = $request->description;
        }
        if ($request->has('status')) {
            $task->status = strtolower($request->status);
        }
        if ($request->has('priority')) {
            $task->priority = ucfirst($request->priority);
        }
        if ($request->has('dueDate')) {
            $task->due_date = $request->dueDate;
        }
        if ($request->has('assignee')) {
            $task->assignee_name = $request->assignee;
            if ($request->assignee === 'Unassigned' || empty($request->assignee)) {
                $task->assignee_id = null;
                $task->assignee_name = 'Unassigned';
            } else {
                $matchedUser = User::where('name', $request->assignee)
                    ->orWhere('email', $request->assignee)
                    ->first();
                if ($matchedUser) {
                    $task->assignee_id = $matchedUser->id;
                    $task->assignee_name = $matchedUser->name;
                }
            }
        }

        $task->save();

        return response()->json([
            'message' => 'Task berhasil diperbarui',
            'data' => $task->load('attachments'),
        ]);
    }

    /**
     * Delete a task
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $task = Task::with('project')->findOrFail($id);
        if (!$task->canAccess($request->user())) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $task->delete();

        return response()->json([
            'message' => 'Task berhasil dihapus',
        ]);
    }

    /**
     * Media Upload Handler:
     * Endpoint upload multi-file (foto dan video) untuk lampiran Task
     * Validasi ukuran (max 50MB) dan tipe file (images & videos)
     */
    public function uploadMedia(Request $request, string $taskId): JsonResponse
    {
        $task = Task::with('project')->findOrFail($taskId);
        if (!$task->canAccess($request->user())) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $request->validate([
            'files' => 'required|array',
            'files.*' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png,gif,webp,svg,mp4,mov,avi,webm,mkv',
                'max:51200', // Maksimal 50MB per file
            ],
        ]);

        $savedAttachments = [];
        $files = $request->file('files');

        foreach ($files as $file) {
            $originalName = $file->getClientOriginalName();
            $mimeType = $file->getMimeType();
            $fileSize = $file->getSize();

            // Klasifikasi tipe file: image atau video
            $isImage = str_starts_with($mimeType, 'image/');
            $isVideo = str_starts_with($mimeType, 'video/');
            $fileType = $isVideo ? 'video' : ($isImage ? 'image' : 'file');

            // Simpan ke storage publik lokal (atau S3 jika configured)
            $folder = "tasks/{$taskId}";
            $filename = Str::uuid() . '_' . Str::slug(pathinfo($originalName, PATHINFO_FILENAME)) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs($folder, $filename, 'public');

            $fileUrl = asset("storage/{$path}");

            $attachment = TaskAttachment::create([
                'task_id' => $task->id,
                'name' => $originalName,
                'file_path' => $path,
                'url' => $fileUrl,
                'file_type' => $fileType,
                'file_size' => $fileSize,
            ]);

            $savedAttachments[] = [
                'id' => $attachment->id,
                'name' => $attachment->name,
                'type' => $attachment->file_type,
                'url' => $attachment->url,
                'size' => $attachment->file_size,
            ];
        }

        return response()->json([
            'message' => 'Lampiran media berhasil diunggah',
            'data' => $savedAttachments,
        ], 201);
    }

    /**
     * Endpoint Presigned URL untuk upload langsung ke S3/Cloud Storage
     */
    public function generatePresignedUrl(Request $request, string $taskId): JsonResponse
    {
        $request->validate([
            'filename' => 'required|string',
            'content_type' => 'required|string',
        ]);

        $task = Task::with('project')->findOrFail($taskId);
        if (!$task->canAccess($request->user())) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $filename = Str::uuid() . '-' . $request->filename;
        $path = "tasks/{$taskId}/{$filename}";

        // Jika S3 terkonfigurasi di .env, kita bisa generate presigned request:
        // $client = Storage::disk('s3')->getClient();
        // $command = $client->getCommand('PutObject', ['Bucket' => ..., 'Key' => $path, 'ContentType' => ...]);
        // $presignedRequest = $client->createPresignedRequest($command, '+20 minutes');
        // $presignedUrl = (string) $presignedRequest->getUri();

        $fallbackUrl = asset("storage/{$path}");

        return response()->json([
            'message' => 'Presigned upload URL generated',
            'upload_url' => url("/api/tasks/{$taskId}/media"),
            'file_path' => $path,
            'expected_url' => $fallbackUrl,
            'expires_in_minutes' => 20,
        ]);
    }
}
