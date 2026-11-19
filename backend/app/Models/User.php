<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'avatar',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_members', 'user_id', 'project_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function chatRooms(): BelongsToMany
    {
        return $this->belongsToMany(ChatRoom::class, 'chat_participants', 'user_id', 'chat_room_id')
            ->withPivot('last_read_at')
            ->withTimestamps();
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function calendarEvents(): HasMany
    {
        return $this->hasMany(CalendarEvent::class, 'user_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    public function friends(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'friends', 'user_id', 'friend_id')
            ->withTimestamps();
    }

    public function notes(): HasMany
    {
        return $this->hasMany(Note::class, 'user_id');
    }

    /**
     * Generate a unique random username based on user full name.
     */
    public static function generateRandomUsername(string $name): string
    {
        $cleanName = \Illuminate\Support\Str::lower(preg_replace('/[^a-zA-Z0-9]/', '', $name));
        if (empty($cleanName)) {
            $cleanName = 'user';
        }
        $cleanName = substr($cleanName, 0, 12);

        do {
            $candidate = $cleanName . '_' . mt_rand(100, 9999);
        } while (static::where('username', $candidate)->exists());

        return $candidate;
    }

    /**
     * Check if the user is a superadmin.
     * Superadmin can view all users' projects, tasks, and notes, but strictly NOT private/group chats.
     */
    public function isSuperAdmin(): bool
    {
        return strtolower($this->role ?? '') === 'superadmin'
            || $this->email === 'superadmin@acme.id'
            || $this->email === 'admin@fokusin.com';
    }
}
