<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'url',
        'type',
        'file_id',
        'embed_url',
        'category',
        'description',
        'content',
        'color',
        'is_starred',
        'sync_status',
        'last_synced_at',
        'last_opened_at',
    ];

    protected function casts(): array
    {
        return [
            'is_starred' => 'boolean',
            'last_synced_at' => 'datetime',
            'last_opened_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
