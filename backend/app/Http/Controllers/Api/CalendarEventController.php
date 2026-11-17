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
     * List calendar events with optional startDate & endDate filter
     */
    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('startDate');
        $endDate = $request->query('endDate');

        $events = CalendarEvent::when($startDate && $endDate, function ($q) use ($startDate, $endDate) {
                $q->whereBetween('event_date', [$startDate, $endDate]);
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
            'event_date' => 'required|date',
            'end_date' => 'nullable|date',
            'time' => 'required|string|max:50',
            'type' => 'required|string|in:Meeting,Deadline,Event',
            'project_id' => 'nullable|string|exists:projects,id',
        ]);

        $currentUser = $request->user() ?? User::first();

        $eventId = 'EV-' . Str::upper(Str::random(5));

        $event = CalendarEvent::create([
            'id' => $eventId,
            'user_id' => $currentUser?->id ?? 1,
            'project_id' => $validated['project_id'] ?? null,
            'title' => $validated['title'],
            'event_date' => $validated['event_date'],
            'end_date' => $validated['end_date'] ?? null,
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
}
