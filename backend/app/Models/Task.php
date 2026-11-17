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
