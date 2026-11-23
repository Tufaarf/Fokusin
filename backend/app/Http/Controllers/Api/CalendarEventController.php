<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CalendarEventController extends Controller
{
    /**
     * List calendar events with optional startDate, endDate, & category/type filter
     */
    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('startDate');
        $endDate = $request->query('endDate');
        $type = $request->query('type') ?? $request->query('category');

        $events = CalendarEvent::when($startDate && $endDate, function ($q) use ($startDate, $endDate) {
                $q->whereBetween('event_date', [$startDate, $endDate]);
            })
            ->when($type && in_array($type, ['Meeting', 'Deadline', 'Event']), function ($q) use ($type) {
                $q->where('type', $type);
            })
            ->orderBy('event_date', 'asc')
            ->orderBy('time', 'asc')
            ->get();

        $formatted = $events->map(function ($event) {
            return [
                'id' => $event->id,
                'title' => $event->title,
                'date' => $event->event_date->toDateString(),
                'endDate' => $event->end_date ? $event->end_date->toDateString() : null,
                'time' => $event->time,
                'type' => $event->type,
                'projectId' => $event->project_id,
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    /**
     * Create calendar event
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'event_date' => 'sometimes|required_without:date|date',
            'date' => 'sometimes|required_without:event_date|date',
            'end_date' => 'nullable|date',
            'endDate' => 'nullable|date',
            'time' => 'required|string|max:50',
            'type' => 'required|string|in:Meeting,Deadline,Event',
            'project_id' => 'nullable|string|exists:projects,id',
            'projectId' => 'nullable|string|exists:projects,id',
        ]);

        $currentUser = $request->user() ?? User::first();

        $eventId = 'EV-' . Str::upper(Str::random(5));

        $event = CalendarEvent::create([
            'id' => $eventId,
            'user_id' => $currentUser?->id ?? 1,
            'project_id' => $validated['project_id'] ?? $validated['projectId'] ?? null,
            'title' => $validated['title'],
            'event_date' => $validated['event_date'] ?? $validated['date'],
            'end_date' => $validated['end_date'] ?? $validated['endDate'] ?? null,
            'time' => $validated['time'],
            'type' => $validated['type'],
        ]);

        return response()->json([
            'message' => 'Event berhasil dibuat',
            'data' => [
                'id' => $event->id,
                'title' => $event->title,
                'date' => $event->event_date->toDateString(),
                'endDate' => $event->end_date ? $event->end_date->toDateString() : null,
                'time' => $event->time,
                'type' => $event->type,
                'projectId' => $event->project_id,
            ]
        ], 201);
    }

    /**
     * Update calendar event
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $event = CalendarEvent::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'event_date' => 'nullable|date',
            'date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'endDate' => 'nullable|date',
            'time' => 'sometimes|required|string|max:50',
            'type' => 'sometimes|required|string|in:Meeting,Deadline,Event',
            'project_id' => 'nullable|string|exists:projects,id',
            'projectId' => 'nullable|string|exists:projects,id',
        ]);

        $payload = [];
        if ($request->has('title')) {
            $payload['title'] = $validated['title'];
        }
        if ($request->has('event_date') || $request->has('date')) {
            $payload['event_date'] = $validated['event_date'] ?? $validated['date'];
        }
        if ($request->has('end_date') || $request->has('endDate')) {
            $payload['end_date'] = $validated['end_date'] ?? $validated['endDate'];
        }
        if ($request->has('time')) {
            $payload['time'] = $validated['time'];
        }
        if ($request->has('type')) {
            $payload['type'] = $validated['type'];
        }
        if ($request->has('project_id') || $request->has('projectId')) {
            $payload['project_id'] = $validated['project_id'] ?? $validated['projectId'];
        }

        $event->update($payload);

        return response()->json([
            'message' => 'Event berhasil diperbarui',
            'data' => [
                'id' => $event->id,
                'title' => $event->title,
                'date' => $event->event_date->toDateString(),
                'endDate' => $event->end_date ? $event->end_date->toDateString() : null,
                'time' => $event->time,
                'type' => $event->type,
                'projectId' => $event->project_id,
            ]
        ]);
    }

    /**
     * Remove calendar event
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $event = CalendarEvent::findOrFail($id);
        $event->delete();

        return response()->json([
            'message' => 'Event berhasil dihapus',
        ]);
    }
}
