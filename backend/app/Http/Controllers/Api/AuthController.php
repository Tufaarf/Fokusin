<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user and generate API token
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
        ], [
            'name.required' => 'Nama lengkap wajib diisi.',
            'name.min' => 'Nama harus terdiri dari minimal 2 karakter.',
            'email.required' => 'Alamat email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah terdaftar di database. Silakan masuk atau gunakan email lain.',
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password harus terdiri dari minimal 6 karakter.',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->createToken('fokusin_auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Registrasi berhasil',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'user',
                'is_superadmin' => $user->isSuperAdmin(),
            ],
            'token' => $token,
        ], 201);
    }

    /**
     * Login user and generate API token
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ], [
            'email.required' => 'Alamat email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password wajib diisi.',
        ]);

        $user = User::where('email', $request->email)->first();

        // Validasi keberadaan akun di database
        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Akun dengan email ini tidak ditemukan di database.'],
            ]);
        }

        // Validasi password
        if (!Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Password yang Anda masukkan salah.'],
            ]);
        }

        // Hapus token lama jika ada agar bersih (opsional) atau buat token baru
        $token = $user->createToken('fokusin_auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login berhasil',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'user',
                'is_superadmin' => $user->isSuperAdmin(),
            ],
            'token' => $token,
        ]);
    }

    /**
     * Logout and revoke current token
     */
    public function logout(Request $request): JsonResponse
    {
        if ($request->user()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json(['message' => 'Logout berhasil']);
    }

    /**
     * Get current authenticated user
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar,
                'role' => $user->role ?? 'user',
                'is_superadmin' => $user->isSuperAdmin(),
            ],
        ]);
    }

    /**
     * Update current authenticated user profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|min:2',
            'email' => 'required|email|max:255|unique:users,email,' . $user->id,
            'avatar' => 'nullable|string',
            'current_password' => 'nullable|string',
            'password' => 'nullable|string|min:6',
        ], [
            'name.required' => 'Nama lengkap wajib diisi.',
            'name.min' => 'Nama minimal terdiri dari 2 karakter.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah digunakan oleh akun lain.',
            'password.min' => 'Password baru harus terdiri dari minimal 6 karakter.',
        ]);

        if (!empty($validated['password'])) {
            if (empty($validated['current_password'])) {
                throw ValidationException::withMessages([
                    'current_password' => ['Password saat ini wajib diisi untuk mengganti password.'],
                ]);
            }

            if (!Hash::check($validated['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Password saat ini yang Anda masukkan salah.'],
                ]);
            }

            $user->password = Hash::make($validated['password']);
        }

        $user->name = $validated['name'];
        $user->email = $validated['email'];

        if (array_key_exists('avatar', $validated)) {
            $avatarVal = $validated['avatar'];
            if (!empty($avatarVal) && str_starts_with($avatarVal, 'data:image/')) {
                // Simpan base64 ke file fisik di disk public storage agar database tetap bersih dan tidak memicu packet size limit
                if (preg_match('/^data:image\/(\w+);base64,/', $avatarVal, $matches)) {
                    $imageType = strtolower($matches[1]);
                    $cleanData = substr($avatarVal, strpos($avatarVal, ',') + 1);
                    $decoded = base64_decode($cleanData);
                    if ($decoded !== false) {
                        $ext = in_array($imageType, ['jpeg', 'jpg', 'png', 'webp', 'gif']) ? ($imageType === 'jpeg' ? 'jpg' : $imageType) : 'jpg';
                        $filename = 'avatar_' . $user->id . '_' . time() . '.' . $ext;
                        \Illuminate\Support\Facades\Storage::disk('public')->put('avatars/' . $filename, $decoded);
                        $user->avatar = '/storage/avatars/' . $filename;
                    } else {
                        $user->avatar = $avatarVal;
                    }
                } else {
                    $user->avatar = $avatarVal;
                }
            } else {
                $user->avatar = $avatarVal;
            }
        }

        $user->save();

        return response()->json([
            'message' => 'Profil berhasil diperbarui.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar,
                'role' => $user->role ?? 'user',
                'is_superadmin' => $user->isSuperAdmin(),
            ],
        ]);
    }

    /**
     * Upload avatar file directly via multipart form data
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,jpg,webp,gif|max:5120',
        ], [
            'avatar.required' => 'File foto profil wajib diunggah.',
            'avatar.image' => 'File harus berupa gambar.',
            'avatar.mimes' => 'Format gambar harus jpeg, png, jpg, atau webp.',
            'avatar.max' => 'Ukuran gambar maksimal 5MB.',
        ]);

        $file = $request->file('avatar');
        $ext = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = 'avatar_' . $user->id . '_' . time() . '.' . $ext;
        $path = $file->storeAs('avatars', $filename, 'public');

        $avatarUrl = '/storage/' . $path;
        $user->avatar = $avatarUrl;
        $user->save();

        return response()->json([
            'message' => 'Foto profil berhasil diperbarui.',
            'avatar' => $avatarUrl,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar,
                'role' => $user->role ?? 'user',
                'is_superadmin' => $user->isSuperAdmin(),
            ],
        ]);
    }
}
