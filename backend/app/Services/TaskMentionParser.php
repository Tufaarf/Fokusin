<?php

namespace App\Services;

use App\Models\Task;

class TaskMentionParser
{
    /**
     * Parse task mention patterns (#TASK-ID) and validate against the project.
     *
     * @param string $text Message content
     * @param string|null $projectId Project ID for validation context
     * @return array Metadata array containing valid task mentions
     */
    public static function parse(string $text, ?string $projectId = null): array
    {
        if (empty($text) || !$projectId) {
            return [];
        }

        // Match patterns like #TASK-138 or #TASK-142 (case-insensitive)
        preg_match_all('/#(TASK-\d+)/i', $text, $matches);

        if (empty($matches[1])) {
            return [];
        }

        // Normalize extracted task IDs (uppercase)
        $extractedIds = array_unique(array_map('strtoupper', $matches[1]));

        // Query database to validate tasks that actually exist in this project
        $validTasks = Task::where('project_id', $projectId)
            ->whereIn('id', $extractedIds)
            ->get(['id', 'project_id', 'title', 'status', 'priority']);

        if ($validTasks->isEmpty()) {
            return [];
        }

        $mentions = [];
        foreach ($validTasks as $task) {
            $mentions[] = [
                'type' => 'task',
                'task_id' => $task->id,
                'project_id' => $task->project_id,
                'title' => $task->title,
                'status' => $task->status,
                'priority' => $task->priority,
            ];
        }

        return [
            'mentions' => $mentions,
            'task_ids' => $validTasks->pluck('id')->toArray(),
        ];
    }
}
