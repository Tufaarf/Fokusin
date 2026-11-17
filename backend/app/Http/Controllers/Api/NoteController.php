<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    /**
     * Helper to format a note instance for frontend consumption.
     */
    private function formatNote(Note $note): array
    {
        return [
            'id' => $note->id,
            'userId' => $note->user_id,
            'userName' => $note->user?->name,
            'userEmail' => $note->user?->email,
            'title' => $note->title,
            'content' => $note->content ?? '',
            'color' => $note->color ?? 'default',
            'isPinned' => (bool) $note->is_pinned,
            'tags' => $note->tags ?? [],
            'createdAt' => $note->created_at ? $note->created_at->toISOString() : null,
            'updatedAt' => $note->updated_at ? $note->updated_at->toISOString() : null,
        ];
    }

    /**
     * Get notes of the authenticated user with optional search and tag filters.
     * Superadmin can view notes from all users. Regular users only see their own notes.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user() ?? User::first();
        if (!$user) {
            return response()->json(['data' => []]);
        }

        $query = Note::with('user');

        // Superadmin bypasses user_id restriction and can view all notes
        if (!$user->isSuperAdmin()) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('q')) {
            $q = trim($request->input('q'));
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('content', 'like', "%{$q}%");
            });
        }

        if ($request->filled('tag')) {
            $tag = $request->input('tag');
            $query->whereJsonContains('tags', $tag);
        }

        $notes = $query->orderBy('is_pinned', 'desc')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'data' => $notes->map(fn($n) => $this->formatNote($n)),
        ]);
    }

    /**
     * Store a new note.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user() ?? User::first();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'nullable|string',
            'color' => 'nullable|string|max:50',
            'is_pinned' => 'nullable|boolean',
            'isPinned' => 'nullable|boolean',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $isPinned = $validated['is_pinned'] ?? $validated['isPinned'] ?? false;

        $note = Note::create([
            'user_id' => $user->id,
            'title' => $validated['title'],
            'content' => $validated['content'] ?? '',
            'color' => $validated['color'] ?? 'default',
            'is_pinned' => $isPinned,
            'tags' => $validated['tags'] ?? [],
        ]);

        return response()->json([
            'message' => 'Catatan berhasil disimpan.',
            'data' => $this->formatNote($note),
        ], 201);
    }

    /**
     * Display a specific note.
     */
    public function show(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $query = Note::with('user');
        if ($user && !$user->isSuperAdmin()) {
            $query->where('user_id', $user->id);
        }
        $note = $query->findOrFail($id);

        return response()->json([
            'data' => $this->formatNote($note),
        ]);
    }

    /**
     * Update an existing note.
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $query = Note::query();
        if ($user && !$user->isSuperAdmin()) {
            $query->where('user_id', $user->id);
        }
        $note = $query->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'nullable|string',
            'color' => 'nullable|string|max:50',
            'is_pinned' => 'nullable|boolean',
            'isPinned' => 'nullable|boolean',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $payload = [];
        if ($request->has('title')) {
            $payload['title'] = $validated['title'];
        }
        if ($request->has('content')) {
            $payload['content'] = $validated['content'] ?? '';
        }
        if ($request->has('color')) {
            $payload['color'] = $validated['color'] ?? 'default';
        }
        if ($request->has('is_pinned') || $request->has('isPinned')) {
            $payload['is_pinned'] = $validated['is_pinned'] ?? $validated['isPinned'] ?? false;
        }
        if ($request->has('tags')) {
            $payload['tags'] = $validated['tags'] ?? [];
        }

        $note->update($payload);

        return response()->json([
            'message' => 'Catatan berhasil diperbarui.',
            'data' => $this->formatNote($note->fresh(['user'])),
        ]);
    }

    /**
     * Remove a note.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $query = Note::query();
        if ($user && !$user->isSuperAdmin()) {
            $query->where('user_id', $user->id);
        }
        $note = $query->findOrFail($id);

        $note->delete();

        return response()->json([
            'message' => 'Catatan berhasil dihapus.',
        ]);
    }
}
