<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory;

    protected $table = 'tasks';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'project_id',
        'title',
        'description',
        'status',
        'priority',
        'due_date',
        'assignee_id',
        'assignee_name',
        'tags',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'datetime',
            'tags' => 'array',
        ];
    }

    protected $appends = ['urgency_score'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class, 'task_id');
    }

    /**
     * Scope query to tasks accessible by a user:
     * - Superadmin sees all tasks
     * - Regular user only sees tasks assigned to them OR tasks in projects they created/are members of
     */
    public function scopeForUser($query, ?User $user)
    {
        if (!$user) {
            return $query;
        }

        if ($user->isSuperAdmin()) {
            return $query;
        }

        return $query->where(function ($sub) use ($user) {
            $sub->where('assignee_id', $user->id)
                ->orWhere('assignee_name', $user->name)
                ->orWhereHas('project', function ($projQ) use ($user) {
                    $projQ->where('created_by', $user->id)
                          ->orWhereHas('members', fn($m) => $m->where('users.id', $user->id));
                });
        });
    }

    /**
     * Check if a user has access to this task
     */
    public function canAccess(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($this->assignee_id === $user->id) {
            return true;
        }

        if ($this->assignee_name && $this->assignee_name === $user->name) {
            return true;
        }

        if ($this->project) {
            if ($this->project->created_by === $user->id) {
                return true;
            }
            return $this->project->members()->where('users.id', $user->id)->exists();
        }

        return false;
    }

    /**
     * Compute Companion Urgency Score
     * Formula combines Priority Weight and Hours to Due Date
     */
    public function getUrgencyScoreAttribute(): float
    {
        $weight = match (strtolower($this->priority ?? 'medium')) {
            'high' => 100,
            'medium' => 50,
            'low' => 20,
            default => 30,
        };

        if (!$this->due_date) {
            return (float) $weight;
        }

        $now = Carbon::now();
        $dueDate = Carbon::parse($this->due_date);
        $hoursDiff = $now->diffInHours($dueDate, false);

        if ($hoursDiff < 0) {
            // Overdue: urgency score surges significantly
            return (float) (($weight * 2) + (abs($hoursDiff) * 3) + 500);
        }

        // Upcoming: earlier due date yields higher urgency score
        return (float) max(0, ($weight * 10) - ($hoursDiff * 1.5));
    }
}
