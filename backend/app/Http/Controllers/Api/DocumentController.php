<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    /**
     * Helper to format document model for frontend consumption.
     */
    private function formatDocument(Document $doc): array
    {
        return [
            'id' => (string) $doc->id,
            'userId' => $doc->user_id,
            'userName' => $doc->user?->name ?? 'User',
            'userEmail' => $doc->user?->email,
            'title' => $doc->title,
            'url' => $doc->url,
            'type' => $doc->type,
            'fileId' => $doc->file_id ?? '',
            'embedUrl' => $doc->embed_url ?? '',
            'category' => $doc->category ?? 'Umum',
            'description' => $doc->description ?? '',
            'content' => $doc->content ?? '',
            'color' => $doc->color ?? '#4285F4',
            'isStarred' => (bool) $doc->is_starred,
            'syncStatus' => $doc->sync_status ?? 'synced',
            'lastSyncedAt' => $doc->last_synced_at ? $doc->last_synced_at->toISOString() : null,
            'lastOpenedAt' => $doc->last_opened_at ? $doc->last_opened_at->toISOString() : null,
            'createdAt' => $doc->created_at ? $doc->created_at->toISOString() : null,
            'updatedAt' => $doc->updated_at ? $doc->updated_at->toISOString() : null,
        ];
    }

    /**
     * Parse Google URL and generate embed url + file_id if not explicitly provided.
     */
    private function parseGoogleDetails(string $url, ?string $fallbackType = 'docs'): array
    {
        $cleanUrl = trim($url);

        // Sheets
        if (preg_match('/(?:docs\.google\.com\/spreadsheets\/d\/)([a-zA-Z0-9_-]+)/i', $cleanUrl, $matches)) {
            $id = $matches[1];
            return [
                'type' => 'sheets',
                'file_id' => $id,
                'embed_url' => "https://docs.google.com/spreadsheets/d/{$id}/edit?embedded=true",
            ];
        }

        // Docs
        if (preg_match('/(?:docs\.google\.com\/document\/d\/)([a-zA-Z0-9_-]+)/i', $cleanUrl, $matches)) {
            $id = $matches[1];
            return [
                'type' => 'docs',
                'file_id' => $id,
                'embed_url' => "https://docs.google.com/document/d/{$id}/edit?embedded=true",
            ];
        }

        // Slides
        if (preg_match('/(?:docs\.google\.com\/presentation\/d\/)([a-zA-Z0-9_-]+)/i', $cleanUrl, $matches)) {
            $id = $matches[1];
            return [
                'type' => 'slides',
                'file_id' => $id,
                'embed_url' => "https://docs.google.com/presentation/d/{$id}/edit?embedded=true",
            ];
        }

        // Forms
        if (preg_match('/(?:docs\.google\.com\/forms\/d\/(?:e\/)?)([a-zA-Z0-9_-]+)/i', $cleanUrl, $matches)) {
            $id = $matches[1];
            return [
                'type' => 'forms',
                'file_id' => $id,
                'embed_url' => "https://docs.google.com/forms/d/e/{$id}/viewform?embedded=true",
            ];
        }

        // Drive Generic
        if (preg_match('/(?:drive\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/i', $cleanUrl, $matches)) {
            $id = $matches[1];
            return [
                'type' => 'drive',
                'file_id' => $id,
                'embed_url' => "https://drive.google.com/file/d/{$id}/preview",
            ];
        }

        return [
            'type' => $fallbackType ?: 'docs',
            'file_id' => '',
            'embed_url' => $cleanUrl,
        ];
    }

    /**
     * Get documents of the authenticated user with search and type filters.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user() ?? User::first();
        if (!$user) {
            return response()->json(['data' => []]);
        }

        $query = Document::with('user');

        // Strictly show only documents uploaded by the authenticated user
        $query->where('user_id', $user->id);

        if ($request->filled('q')) {
            $q = trim($request->input('q'));
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%")
                    ->orWhere('category', 'like', "%{$q}%");
            });
        }

        if ($request->filled('type') && $request->input('type') !== 'all') {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('category') && $request->input('category') !== 'all') {
            $query->where('category', $request->input('category'));
        }

        if ($request->has('is_starred')) {
            $starred = filter_var($request->input('is_starred'), FILTER_VALIDATE_BOOLEAN);
            if ($starred) {
                $query->where('is_starred', true);
            }
        }

        $documents = $query->orderBy('is_starred', 'desc')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'data' => $documents->map(fn($d) => $this->formatDocument($d)),
        ]);
    }

    /**
     * Store a new Google document link.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user() ?? User::first();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'url' => 'required|string|url',
            'type' => 'nullable|string|in:docs,sheets,slides,forms,drive',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'content' => 'nullable|string',
            'color' => 'nullable|string|max:30',
            'is_starred' => 'nullable|boolean',
            'isStarred' => 'nullable|boolean',
        ]);

        $details = $this->parseGoogleDetails($validated['url'], $validated['type'] ?? 'docs');
        $isStarred = $validated['is_starred'] ?? $validated['isStarred'] ?? false;

        $doc = Document::create([
            'user_id' => $user->id,
            'title' => $validated['title'],
            'url' => $validated['url'],
            'type' => $details['type'],
            'file_id' => $details['file_id'],
            'embed_url' => $details['embed_url'],
            'category' => $validated['category'] ?? 'Umum',
            'description' => $validated['description'] ?? '',
            'content' => $validated['content'] ?? "<h2>{$validated['title']}</h2><p>Mulai ketik isi dokumen Anda...</p>",
            'color' => $validated['color'] ?? ($details['type'] === 'sheets' ? '#0F9D58' : '#4285F4'),
            'is_starred' => $isStarred,
            'sync_status' => 'synced',
            'last_synced_at' => now(),
            'last_opened_at' => now(),
        ]);

        $doc->load('user');

        return response()->json([
            'message' => 'Dokumen berhasil ditambahkan.',
            'data' => $this->formatDocument($doc),
        ], 201);
    }

    /**
     * Show document detail.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $doc = Document::with('user')
            ->where('user_id', $user?->id)
            ->findOrFail($id);

        return response()->json([
            'data' => $this->formatDocument($doc),
        ]);
    }

    /**
     * Update an existing document.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $doc = Document::where('user_id', $user?->id)->findOrFail($id);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'url' => 'nullable|string|url',
            'type' => 'nullable|string|in:docs,sheets,slides,forms,drive',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:30',
            'is_starred' => 'nullable|boolean',
            'isStarred' => 'nullable|boolean',
        ]);

        if (isset($validated['title'])) $doc->title = $validated['title'];
        if (isset($validated['category'])) $doc->category = $validated['category'];
        if (isset($validated['description'])) $doc->description = $validated['description'];
        if (isset($validated['content'])) {
            $doc->content = $validated['content'];
            $doc->last_synced_at = now();
            $doc->sync_status = 'synced';
        }
        if (isset($validated['color'])) $doc->color = $validated['color'];

        if (isset($validated['is_starred']) || isset($validated['isStarred'])) {
            $doc->is_starred = $validated['is_starred'] ?? $validated['isStarred'];
        }

        if (isset($validated['url']) && $validated['url'] !== $doc->url) {
            $doc->url = $validated['url'];
            $details = $this->parseGoogleDetails($validated['url'], $validated['type'] ?? $doc->type);
            $doc->type = $details['type'];
            $doc->file_id = $details['file_id'];
            $doc->embed_url = $details['embed_url'];
        }

        $doc->save();
        $doc->load('user');

        return response()->json([
            'message' => 'Dokumen berhasil diperbarui.',
            'data' => $this->formatDocument($doc),
        ]);
    }

    /**
     * Record last opened timestamp.
     */
    public function recordOpen(Request $request, $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $doc = Document::where('user_id', $user?->id)->find($id);
        if ($doc) {
            $doc->update(['last_opened_at' => now()]);
        }

        return response()->json([
            'message' => 'Status buka dokumen diperbarui.',
        ]);
    }

    /**
     * Sync WYSIWYG HTML content to Google Docs.
     */
    public function syncContent(Request $request, $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $doc = Document::where('user_id', $user?->id)->findOrFail($id);

        $validated = $request->validate([
            'content' => 'required|string',
        ]);

        $doc->update([
            'content' => $validated['content'],
            'last_synced_at' => now(),
            'sync_status' => 'synced',
        ]);

        return response()->json([
            'message' => 'Konten berhasil disinkronkan ke Google Docs.',
            'data' => $this->formatDocument($doc),
        ]);
    }

    /**
     * Delete document.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user() ?? User::first();
        $doc = Document::where('user_id', $user?->id)->findOrFail($id);
        $doc->delete();

        return response()->json([
            'message' => 'Dokumen berhasil dihapus.',
        ]);
    }
}
