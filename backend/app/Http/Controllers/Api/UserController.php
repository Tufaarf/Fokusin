<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    /**
     * Ensure the authenticated user has superadmin privileges.
     */
    private function ensureSuperAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            abort(403, 'Akses ditolak. Fitur ini hanya untuk Superadmin.');
        }
    }

    /**
     * Display a listing of all users (with search and role filter).
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $query = User::query()->withCount(['tasks', 'projects', 'notes']);

        if ($request->filled('q')) {
            $search = trim($request->q);
            $cleanSearch = ltrim($search, '@');
            $query->where(function ($q) use ($search, $cleanSearch) {
                $q->where('name', 'like', "%{$cleanSearch}%")
                  ->orWhere('username', 'like', "%{$cleanSearch}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role') && in_array(strtolower($request->role), ['user', 'superadmin', 'admin'])) {
            $query->where('role', strtolower($request->role));
        }

        $users = $query->orderBy('id', 'desc')->get()->map(function ($u) {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'email' => $u->email,
                'role' => $u->role ?? 'user',
                'avatar' => $u->avatar,
                'is_superadmin' => $u->isSuperAdmin(),
                'tasks_count' => $u->tasks_count ?? 0,
                'projects_count' => $u->projects_count ?? 0,
                'notes_count' => $u->notes_count ?? 0,
                'created_at' => $u->created_at ? $u->created_at->toISOString() : null,
                'updated_at' => $u->updated_at ? $u->updated_at->toISOString() : null,
            ];
        });

        return response()->json([
            'data' => $users,
            'total' => $users->count(),
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $validated = $request->validate([
            'name' => 'required|string|min:2|max:255',
            'username' => 'nullable|string|min:3|max:50|regex:/^[a-zA-Z0-9_.-]+$/|unique:users,username',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => 'required|string|in:user,superadmin,admin',
            'avatar' => 'nullable|string',
        ], [
            'name.required' => 'Nama pengguna wajib diisi.',
            'name.min' => 'Nama minimal terdiri dari 2 karakter.',
            'username.min' => 'Username minimal terdiri dari 3 karakter.',
            'username.max' => 'Username maksimal 50 karakter.',
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik (.), strip (-), dan garis bawah (_).',
            'username.unique' => 'Username ini sudah digunakan.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah terdaftar di sistem.',
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password minimal terdiri dari 6 karakter.',
            'role.required' => 'Peran (Role) wajib dipilih.',
            'role.in' => 'Pilihan peran tidak valid.',
        ]);

        $username = !empty($validated['username'])
            ? strtolower(trim($validated['username']))
            : User::generateRandomUsername($validated['name']);

        $newUser = User::create([
            'name' => $validated['name'],
            'username' => $username,
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => strtolower($validated['role']),
            'avatar' => $validated['avatar'] ?? null,
        ]);

        return response()->json([
            'message' => 'User baru berhasil ditambahkan.',
            'data' => [
                'id' => $newUser->id,
                'name' => $newUser->name,
                'username' => $newUser->username,
                'email' => $newUser->email,
                'role' => $newUser->role ?? 'user',
                'avatar' => $newUser->avatar,
                'is_superadmin' => $newUser->isSuperAdmin(),
                'tasks_count' => 0,
                'projects_count' => 0,
                'notes_count' => 0,
                'created_at' => $newUser->created_at ? $newUser->created_at->toISOString() : null,
                'updated_at' => $newUser->updated_at ? $newUser->updated_at->toISOString() : null,
            ],
        ], 201);
    }

    /**
     * Display the specified user details.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $user = User::withCount(['tasks', 'projects', 'notes'])->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role ?? 'user',
                'avatar' => $user->avatar,
                'is_superadmin' => $user->isSuperAdmin(),
                'tasks_count' => $user->tasks_count,
                'projects_count' => $user->projects_count,
                'notes_count' => $user->notes_count,
                'created_at' => $user->created_at ? $user->created_at->toISOString() : null,
                'updated_at' => $user->updated_at ? $user->updated_at->toISOString() : null,
            ],
        ]);
    }

    /**
     * Update the specified user in storage.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|min:2|max:255',
            'username' => 'nullable|string|min:3|max:50|regex:/^[a-zA-Z0-9_.-]+$/|unique:users,username,' . $user->id,
            'email' => 'required|email|max:255|unique:users,email,' . $user->id,
            'role' => 'required|string|in:user,superadmin,admin',
            'password' => 'nullable|string|min:6',
            'avatar' => 'nullable|string',
        ], [
            'name.required' => 'Nama pengguna wajib diisi.',
            'name.min' => 'Nama minimal terdiri dari 2 karakter.',
            'username.min' => 'Username minimal terdiri dari 3 karakter.',
            'username.max' => 'Username maksimal 50 karakter.',
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik (.), strip (-), dan garis bawah (_).',
            'username.unique' => 'Username ini sudah digunakan oleh pengguna lain.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah digunakan oleh pengguna lain.',
            'password.min' => 'Password minimal terdiri dari 6 karakter.',
            'role.required' => 'Peran (Role) wajib dipilih.',
            'role.in' => 'Pilihan peran tidak valid.',
        ]);

        // Cegah superadmin yang sedang login mengubah rolenya sendiri menjadi regular user
        if ($request->user()->id === $user->id && strtolower($validated['role']) !== 'superadmin') {
            throw ValidationException::withMessages([
                'role' => ['Anda tidak dapat mencabut hak akses Superadmin dari akun Anda sendiri saat ini.'],
            ]);
        }

        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->role = strtolower($validated['role']);

        if (!empty($validated['username'])) {
            $user->username = strtolower(trim($validated['username']));
        } elseif (empty($user->username)) {
            $user->username = User::generateRandomUsername($user->name);
        }

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        if (array_key_exists('avatar', $validated)) {
            $user->avatar = $validated['avatar'];
        }

        $user->save();

        return response()->json([
            'message' => 'Data user berhasil diperbarui.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role ?? 'user',
                'avatar' => $user->avatar,
                'is_superadmin' => $user->isSuperAdmin(),
                'created_at' => $user->created_at ? $user->created_at->toISOString() : null,
                'updated_at' => $user->updated_at ? $user->updated_at->toISOString() : null,
            ],
        ]);
    }

    /**
     * Remove the specified user from storage.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $user = User::findOrFail($id);

        // Jangan izinkan superadmin menghapus dirinya sendiri
        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ], 422);
        }

        // Jangan izinkan menghapus superadmin utama sistem demi keamanan
        if (in_array(strtolower($user->email), ['superadmin@acme.id', 'admin@fokusin.com'])) {
            return response()->json([
                'message' => 'Akun Superadmin utama sistem tidak dapat dihapus demi keamanan.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'message' => "User {$user->name} berhasil dihapus dari sistem.",
        ]);
    }
}
