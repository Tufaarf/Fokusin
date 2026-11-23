<?php

namespace Tests\Feature;

use App\Mail\CalendarReminderMail;
use App\Mail\TaskReminderMail;
use App\Models\CalendarEvent;
use App\Models\ChatMessage;
use App\Models\ChatParticipant;
use App\Models\ChatRoom;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use App\Services\TaskMentionParser;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FokusinBackendTest extends TestCase
{
    use DatabaseTransactions;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::firstOrCreate(
            ['email' => 'testuser@acme.id'],
            ['name' => 'Test User', 'password' => bcrypt('password')]
        );
    }

    /**
     * 2. Test Atomic Project & Group Chat Creation
     */
    public function test_atomic_project_and_group_chat_creation_success(): void
    {
        $member = User::firstOrCreate(
            ['email' => 'colleague@acme.id'],
            ['name' => 'Colleague', 'password' => bcrypt('password')]
        );

        $payload = [
            'name' => 'Quantum Core Engine',
            'color' => '#6366f1',
            'member_emails' => ['colleague@acme.id'],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/projects', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('project.name', 'Quantum Core Engine')
            ->assertJsonPath('chat_room.name', 'Quantum Core Engine')
            ->assertJsonPath('chat_room.type', 'group');

        $this->assertDatabaseHas('projects', ['name' => 'Quantum Core Engine']);
        $this->assertDatabaseHas('chat_rooms', ['name' => 'Quantum Core Engine', 'type' => 'PROJECT_GROUP']);
    }

    /**
     * 2. Test Atomic Project Creation Rollback on invalid member email
     */
    public function test_atomic_project_creation_rollbacks_on_failure(): void
    {
        $payload = [
            'name' => 'Should Not Exist Project',
            'color' => '#ef4444',
            'member_emails' => ['ghost_never_registered@acme.id'],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/projects', $payload);

        $response->assertStatus(422);

        $this->assertDatabaseMissing('projects', ['name' => 'Should Not Exist Project']);
        $this->assertDatabaseMissing('chat_rooms', ['name' => 'Should Not Exist Project']);
    }

    /**
     * 3. Test H-3 Event Reminder Scheduler Command
     */
    public function test_h3_event_reminder_command(): void
    {
        $event = CalendarEvent::updateOrCreate(
            ['id' => 'TEST-EV-H2'],
            [
                'user_id' => $this->user->id,
                'title' => 'Important Test H-2 Milestone',
                'event_date' => Carbon::today()->addDays(2)->toDateString(),
                'time' => '14:00',
                'type' => 'Meeting',
            ]
        );

        $exitCode = Artisan::call('events:remind-h3');
        $this->assertEquals(0, $exitCode);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->user->id,
            'type' => 'EVENT_REMINDER_H3',
        ]);
    }

    /**
     * 3b. Test H-3 Event Reminder Sends Email to Calendar Owner
     */
    public function test_h3_event_reminder_sends_email_to_calendar_owner(): void
    {
        Mail::fake();

        $event = CalendarEvent::updateOrCreate(
            ['id' => 'TEST-EV-H3-EMAIL'],
            [
                'user_id' => $this->user->id,
                'title' => 'Strategi Rilis Produk Fokusin',
                'event_date' => Carbon::today()->addDays(3)->toDateString(),
                'time' => '10:00',
                'type' => 'Meeting',
            ]
        );

        $exitCode = Artisan::call('events:remind-h3', ['--force' => true]);
        $this->assertEquals(0, $exitCode);

        Mail::assertSent(CalendarReminderMail::class, function ($mail) {
            return $mail->hasTo($this->user->email)
                && $mail->daysRemaining === 3
                && $mail->hTag === 'H-3'
                && $mail->hasFrom('officialfokusin@gmail.com');
        });
    }

    /**
     * 3c. Test H-3 Task Reminder Sends Email to Task Owner / Assignee
     */
    public function test_h3_task_reminder_sends_email_to_task_assignee(): void
    {
        Mail::fake();

        $project = Project::firstOrCreate(
            ['id' => 'test-proj-h3'],
            ['name' => 'Project H3 Reminder Test', 'color' => '#8b5cf6', 'created_by' => $this->user->id]
        );

        $task = Task::updateOrCreate(
            ['id' => 'TASK-H3-EMAIL'],
            [
                'project_id' => $project->id,
                'title' => 'Implementasi Modul Pembayaran',
                'status' => 'progress',
                'priority' => 'High',
                'assignee_id' => $this->user->id,
                'due_date' => Carbon::today()->addDays(3)->setTime(16, 0, 0),
            ]
        );

        $exitCode = Artisan::call('events:remind-h3', ['--force' => true]);
        $this->assertEquals(0, $exitCode);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->user->id,
            'type' => 'TASK_REMINDER_H3',
        ]);

        Mail::assertSent(TaskReminderMail::class, function ($mail) {
            return $mail->hasTo($this->user->email)
                && $mail->daysRemaining === 3
                && $mail->hTag === 'H-3'
                && $mail->hasFrom('officialfokusin@gmail.com');
        });
    }

    /**
     * 3d. Test Trigger H-3 Endpoint API
     */
    public function test_trigger_h3_endpoint_api(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/notifications/trigger-h3', ['force' => true]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Proses pengingat H-3 berhasil dijalankan');
    }

    /**
     * 3e. Test Webhook Cron Trigger Endpoint (for Railway / External Cron)
     */
    public function test_webhook_cron_trigger_endpoint(): void
    {
        $response = $this->getJson('/api/cron/remind-h3?force=1');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('message', 'Scheduler pengingat H-3 berhasil dijalankan melalui Webhook Cron');
    }

    /**
     * 4. Test Dashboard & Companion Urgency Ranking
     */
    public function test_dashboard_endpoint_and_companion_urgency(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'events',
                'unfinished_tasks',
                'companion_tasks',
                'unreplied_chats',
                'summary' => ['done_this_week', 'total_active_tasks'],
            ]);
    }

    /**
     * 5. Test Chat Mention Parser and Deep Linking
     */
    public function test_chat_task_mention_parser(): void
    {
        $project = Project::firstOrCreate(
            ['id' => 'test-proj'],
            ['name' => 'Test Project', 'color' => '#10b981', 'created_by' => $this->user->id]
        );

        $task = Task::firstOrCreate(
            ['id' => 'TASK-777'],
            [
                'project_id' => $project->id,
                'title' => 'Critical Security Audit',
                'status' => 'progress',
                'priority' => 'High',
            ]
        );

        $parsed = TaskMentionParser::parse('Tolong cek #TASK-777 dan abaikan #TASK-000', $project->id);

        $this->assertNotEmpty($parsed['mentions']);
        $this->assertEquals('TASK-777', $parsed['mentions'][0]['task_id']);
        $this->assertEquals('Critical Security Audit', $parsed['mentions'][0]['title']);
    }

    /**
     * 6. Test Media Upload Handler
     */
    public function test_task_media_upload(): void
    {
        Storage::fake('public');

        $project = Project::firstOrCreate(
            ['id' => 'test-proj'],
            ['name' => 'Test Project', 'color' => '#10b981', 'created_by' => $this->user->id]
        );

        $task = Task::firstOrCreate(
            ['id' => 'TASK-777'],
            [
                'project_id' => $project->id,
                'title' => 'Critical Security Audit',
                'status' => 'progress',
                'priority' => 'High',
            ]
        );

        $file1 = UploadedFile::fake()->create('architecture.png', 500, 'image/png');
        $file2 = UploadedFile::fake()->create('walkthrough.mp4', 1500, 'video/mp4');

        $response = $this->actingAs($this->user)
            ->postJson("/api/tasks/{$task->id}/media", [
                'files' => [$file1, $file2],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.0.type', 'image')
            ->assertJsonPath('data.1.type', 'video');
    }
}
