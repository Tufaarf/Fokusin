<?php

namespace Database\Seeders;

use App\Models\CalendarEvent;
use App\Models\ChatMessage;
use App\Models\ChatParticipant;
use App\Models\ChatRoom;
use App\Models\Friend;
use App\Models\Note;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use App\Services\TaskMentionParser;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with complete realistic data.
     */
    public function run(): void
    {
        // 1. Users
        $usersData = [
            ['name' => 'Super Admin', 'email' => 'superadmin@acme.id', 'role' => 'superadmin'],
            ['name' => 'ADMIN FOKUSIN', 'email' => 'admin@fokusin.com', 'role' => 'superadmin'],
            ['name' => 'Daffa Thufail Arrofi', 'email' => 'daffa.rfai@gmail.com', 'role' => 'user'],
            ['name' => 'You', 'email' => 'you@acme.id', 'role' => 'user'],
            ['name' => 'Naya Putri', 'email' => 'naya@acme.id', 'role' => 'user'],
            ['name' => 'Rehan Ahmad', 'email' => 'rehan@acme.id', 'role' => 'user'],
            ['name' => 'Alif Rahman', 'email' => 'alif@acme.id', 'role' => 'user'],
            ['name' => 'Sarah Kusuma', 'email' => 'sarah@acme.id', 'role' => 'user'],
        ];

        $users = [];
        foreach ($usersData as $userData) {
            $users[$userData['email']] = User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => Hash::make('password'),
                    'avatar' => null,
                    'role' => $userData['role'] ?? 'user',
                ]
            );
        }

        $superadmin = $users['superadmin@acme.id'];
        $daffa = $users['daffa.rfai@gmail.com'];
        $you = $users['you@acme.id'];
        $naya = $users['naya@acme.id'];
        $rehan = $users['rehan@acme.id'];
        $alif = $users['alif@acme.id'];
        $sarah = $users['sarah@acme.id'];

        // Friends
        foreach ([$you, $daffa] as $mainUser) {
            Friend::firstOrCreate(['user_id' => $mainUser->id, 'friend_id' => $naya->id]);
            Friend::firstOrCreate(['user_id' => $naya->id, 'friend_id' => $mainUser->id]);
            Friend::firstOrCreate(['user_id' => $mainUser->id, 'friend_id' => $alif->id]);
            Friend::firstOrCreate(['user_id' => $alif->id, 'friend_id' => $mainUser->id]);
        }

        // 2. Projects & ProjectMembers
        $projectsData = [
            [
                'id' => 'orbit',
                'name' => 'Orbit Mobile App',
                'color' => '#7c3aed',
                'members' => [$you, $daffa, $naya, $rehan],
            ],
            [
                'id' => 'atlas',
                'name' => 'Atlas Website',
                'color' => '#0284c7',
                'members' => [$you, $daffa, $alif],
            ],
            [
                'id' => 'growth',
                'name' => 'Growth Experiments',
                'color' => '#d97706',
                'members' => [$you, $daffa, $sarah],
            ],
        ];

        foreach ($projectsData as $p) {
            $project = Project::updateOrCreate(
                ['id' => $p['id']],
                [
                    'name' => $p['name'],
                    'color' => $p['color'],
                    'created_by' => $you->id,
                ]
            );

            foreach ($p['members'] as $m) {
                ProjectMember::firstOrCreate([
                    'project_id' => $project->id,
                    'user_id' => $m->id,
                ], [
                    'role' => $m->id === $you->id ? 'owner' : 'member',
                ]);
            }
        }

        // 3. Tasks
        $tasksData = [
            [
                'id' => 'TASK-142',
                'project_id' => 'orbit',
                'title' => 'Finalize onboarding flow',
                'description' => 'Review the final onboarding screens and prepare the interaction notes for engineering.',
                'status' => 'progress',
                'priority' => 'High',
                'due_date' => Carbon::now()->addDay()->setHour(17),
                'assignee_id' => $naya->id,
                'assignee_name' => 'Naya P.',
                'tags' => ['Design', 'Mobile'],
            ],
            [
                'id' => 'TASK-145',
                'project_id' => 'orbit',
                'title' => 'Empty state illustrations',
                'description' => 'Create a consistent family of empty states for the core mobile experience.',
                'status' => 'todo',
                'priority' => 'Medium',
                'due_date' => Carbon::now()->addDays(4)->setHour(15),
                'assignee_id' => $you->id,
                'assignee_name' => 'You',
                'tags' => ['Design'],
            ],
            [
                'id' => 'TASK-138',
                'project_id' => 'orbit',
                'title' => 'API contract review',
                'description' => 'Align mobile endpoints with the latest product requirements.',
                'status' => 'review',
                'priority' => 'High',
                'due_date' => Carbon::now()->addDays(2)->setHour(12),
                'assignee_id' => $rehan->id,
                'assignee_name' => 'Rehan A.',
                'tags' => ['Backend'],
            ],
            [
                'id' => 'TASK-132',
                'project_id' => 'orbit',
                'title' => 'Design token migration',
                'description' => 'Migrate all legacy colors and spacing values to semantic tokens.',
                'status' => 'done',
                'priority' => 'Medium',
                'due_date' => Carbon::now()->subDays(2)->setHour(18),
                'assignee_id' => $you->id,
                'assignee_name' => 'You',
                'tags' => ['System'],
            ],
            [
                'id' => 'TASK-208',
                'project_id' => 'atlas',
                'title' => 'Pricing page content',
                'description' => 'Refine pricing copy and validate plan comparison.',
                'status' => 'todo',
                'priority' => 'High',
                'due_date' => Carbon::now()->addDays(3)->setHour(14),
                'assignee_id' => $alif->id,
                'assignee_name' => 'Alif R.',
                'tags' => ['Content'],
            ],
            [
                'id' => 'TASK-211',
                'project_id' => 'atlas',
                'title' => 'Core Web Vitals audit',
                'description' => 'Profile production pages and document priority fixes.',
                'status' => 'progress',
                'priority' => 'Medium',
                'due_date' => Carbon::now()->addDays(6)->setHour(16),
                'assignee_id' => $you->id,
                'assignee_name' => 'You',
                'tags' => ['Frontend'],
            ],
            [
                'id' => 'TASK-305',
                'project_id' => 'growth',
                'title' => 'Referral hypothesis',
                'description' => 'Draft the referral experiment plan and success criteria.',
                'status' => 'review',
                'priority' => 'Low',
                'due_date' => Carbon::now()->addDays(5)->setHour(11),
                'assignee_id' => $sarah->id,
                'assignee_name' => 'Sarah K.',
                'tags' => ['Research'],
            ],
        ];

        foreach ($tasksData as $t) {
            Task::updateOrCreate(
                ['id' => $t['id']],
                $t
            );
        }

        // 4. Calendar Events (H-1, H-2, H-3 and future)
        $eventsData = [
            [
                'id' => 'EV-1',
                'user_id' => $you->id,
                'project_id' => 'orbit',
                'title' => 'Orbit design critique',
                'event_date' => Carbon::today()->addDay()->toDateString(), // H-1
                'time' => '09:30',
                'type' => 'Meeting',
            ],
            [
                'id' => 'EV-2',
                'user_id' => $you->id,
                'project_id' => 'orbit',
                'title' => 'API review deadline',
                'event_date' => Carbon::today()->addDays(2)->toDateString(), // H-2
                'time' => '17:00',
                'type' => 'Deadline',
            ],
            [
                'id' => 'EV-3',
                'user_id' => $you->id,
                'project_id' => null,
                'title' => 'Weekly product sync',
                'event_date' => Carbon::today()->addDays(3)->toDateString(), // H-3
                'time' => '10:00',
                'type' => 'Meeting',
            ],
            [
                'id' => 'EV-4',
                'user_id' => $you->id,
                'project_id' => 'atlas',
                'title' => 'Atlas content handoff',
                'event_date' => Carbon::today()->addDays(5)->toDateString(),
                'time' => '14:00',
                'type' => 'Event',
            ],
            [
                'id' => 'EV-5',
                'user_id' => $you->id,
                'project_id' => 'growth',
                'title' => 'Growth retrospective',
                'event_date' => Carbon::today()->addDays(7)->toDateString(),
                'time' => '15:30',
                'type' => 'Meeting',
            ],
        ];

        foreach ($eventsData as $e) {
            CalendarEvent::updateOrCreate(
                ['id' => $e['id']],
                $e
            );
        }

        // 5. Chat Rooms, Participants, and Messages
        $chatRoomsData = [
            [
                'id' => 'chat-naya',
                'name' => 'Naya Putri',
                'type' => 'direct',
                'project_id' => null,
                'participants' => [$you, $daffa, $naya],
                'messages' => [
                    ['user' => $naya, 'text' => 'Aku sudah update flow onboarding. Bisa cek sore ini?'],
                    ['user' => $naya, 'text' => 'Ada sedikit perubahan di step permissions.'],
                ],
            ],
            [
                'id' => 'chat-orbit',
                'name' => 'Orbit Mobile App',
                'type' => 'PROJECT_GROUP',
                'project_id' => 'orbit',
                'participants' => [$you, $daffa, $naya, $rehan],
                'messages' => [
                    ['user' => $rehan, 'text' => 'API contract untuk #TASK-138 sudah siap direview.'],
                    ['user' => $you, 'text' => 'Sip, aku cek setelah standup.'],
                    ['user' => $naya, 'text' => 'Tolong sekalian cek dependency ke #TASK-142 ya.'],
                ],
            ],
            [
                'id' => 'chat-alif',
                'name' => 'Alif Rahman',
                'type' => 'direct',
                'project_id' => null,
                'participants' => [$you, $daffa, $alif],
                'messages' => [
                    ['user' => $you, 'text' => 'Pricing page sudah aku kasih catatan.'],
                ],
            ],
            [
                'id' => 'chat-atlas',
                'name' => 'Atlas Website',
                'type' => 'PROJECT_GROUP',
                'project_id' => 'atlas',
                'participants' => [$you, $daffa, $alif],
                'messages' => [
                    ['user' => $alif, 'text' => 'Copy untuk #TASK-208 sudah masuk versi final.'],
                ],
            ],
        ];

        foreach ($chatRoomsData as $c) {
            $room = ChatRoom::updateOrCreate(
                ['id' => $c['id']],
                [
                    'name' => $c['name'],
                    'type' => $c['type'],
                    'project_id' => $c['project_id'],
                    'created_by' => $you->id,
                ]
            );

            foreach ($c['participants'] as $p) {
                ChatParticipant::firstOrCreate([
                    'chat_room_id' => $room->id,
                    'user_id' => $p->id,
                ], [
                    'last_read_at' => (($p->id === $you->id || $p->id === $daffa->id) && $room->id === 'chat-alif') ? now() : null,
                ]);
            }

            foreach ($c['messages'] as $m) {
                // Parse #TASK-ID mentions if room has project_id
                $metadata = [];
                if ($room->project_id) {
                    $parsed = TaskMentionParser::parse($m['text'], $room->project_id);
                    if (!empty($parsed['mentions'])) {
                        $metadata = $parsed;
                    }
                }

                ChatMessage::firstOrCreate([
                    'chat_room_id' => $room->id,
                    'user_id' => $m['user']->id,
                    'message' => $m['text'],
                ], [
                    'metadata' => !empty($metadata) ? $metadata : null,
                ]);
            }
        }

        // 6. Notes (WYSIWYG Rich Notes)
        $sampleNotes = [
            [
                'title' => '💡 Ide Fitur Baru & Roadmap Q4',
                'color' => 'amber',
                'is_pinned' => true,
                'tags' => ['Roadmap', 'Ide', 'Fokusin'],
                'content' => '<h2>Roadmap Fitur Prioritas Fokusin</h2><p>Berikut adalah beberapa ide utama yang perlu dieksekusi bersama tim untuk meningkatkan produktivitas:</p><ul><li><strong>WYSIWYG Rich Notes:</strong> Menyimpan dokumen dan catatan berformat (heading, list, blockquote, text style) langsung di aplikasi.</li><li><strong>Task Reminders & Push:</strong> Integrasi notifikasi H-3 dan H-1 deadline.</li><li><strong>Dark Mode Polishing:</strong> Memastikan kontras elemen warna dan kenyamanan membaca.</li></ul><blockquote><p>"Fokus pada hal penting, selesaikan satu per satu tanpa distraksi."</p></blockquote>',
            ],
            [
                'title' => '📝 Catatan Rapat Sprint Planning',
                'color' => 'violet',
                'is_pinned' => true,
                'tags' => ['Meeting', 'Sprint'],
                'content' => '<h3>Sprint Planning #14</h3><p><strong>Tanggal:</strong> 17 November 2026</p><p><strong>Peserta:</strong> Tim Fokusin (Daffa, Naya, Alif, Sarah)</p><h4>Poin Pembahasan:</h4><ol><li>Review performa database query di Task Controller dan optimasi eager loading.</li><li>Implementasi modul Catatan (Notes) lengkap dengan rich text editor WYSIWYG.</li><li>Integrasi live chat WebSocket dengan Laravel Echo & Reverb.</li></ol><p><em>Action item:</em> Backend siapkan endpoint REST API, Frontend hubungkan navigasi dan autosave.</p>',
            ],
            [
                'title' => '📚 Snippet & Dokumentasi Arsitektur',
                'color' => 'blue',
                'is_pinned' => false,
                'tags' => ['Dokumentasi', 'Dev'],
                'content' => '<h3>Arsitektur Fokusin Workspace</h3><p>Aplikasi ini dibangun dengan arsitektur decoupled modern:</p><ul><li><strong>Frontend:</strong> React 19 + Vite 8 + Tailwind CSS v4 + TipTap WYSIWYG + Zustand State</li><li><strong>Backend:</strong> Laravel 12 API + Sanctum Token Auth + MySQL</li><li><strong>Realtime:</strong> Laravel Reverb + Laravel Echo</li></ul><p>Perintah menjalankan lokal server:</p><pre><code>php artisan serve --host=0.0.0.0 --port=8000
pnpm dev</code></pre>',
            ],
            [
                'title' => '✅ Checklist Peluncuran Modul Catatan',
                'color' => 'emerald',
                'is_pinned' => false,
                'tags' => ['Checklist', 'Release'],
                'content' => '<h3>Daftar Verifikasi Fitur Notes</h3><p>Pastikan item-item berikut telah teruji sebelum rilis ke tim:</p><ul><li>Menu Notes muncul di navigasi desktop (Sidebar) dan mobile (Bottom Nav).</li><li>Editor WYSIWYG mendukung Bold, Italic, Underline, Heading 1-3, List, dan Quote.</li><li>Fitur Pin Catatan berfungsi dan menempatkan catatan di bagian atas.</li><li>Pencarian catatan berdasarkan judul atau teks isi responsif secara realtime.</li><li>Penyimpanan otomatis (Autosave) dan tombol simpan manual bekerja baik.</li></ul>',
            ],
        ];

        foreach ([$you, $daffa] as $targetUser) {
            foreach ($sampleNotes as $sn) {
                Note::firstOrCreate(
                    [
                        'user_id' => $targetUser->id,
                        'title' => $sn['title'],
                    ],
                    [
                        'content' => $sn['content'],
                        'color' => $sn['color'],
                        'is_pinned' => $sn['is_pinned'],
                        'tags' => $sn['tags'],
                    ]
                );
            }
        }

        // Catatan khusus panduan akun Superadmin
        Note::firstOrCreate(
            [
                'user_id' => $superadmin->id,
                'title' => '🛡️ Panduan & Batasan Akses Superadmin',
            ],
            [
                'content' => '<h2>Hak Akses Superadmin Fokusin</h2><p>Akun Superadmin dirancang untuk visibilitas dan supervisi operasional:</p><ul><li><strong>Catatan & Dokumen:</strong> Superadmin dapat memantau dan membaca seluruh catatan dari semua user tim (Daffa, You, Naya, dll.) secara transparan.</li><li><strong>Project & Task:</strong> Superadmin dapat melihat seluruh proyek tim (Orbit, Atlas, Growth) beserta progres task kanban-nya.</li><li><strong>Privasi Percakapan (Chat Protection):</strong> Superadmin <em>TIDAK DAPAT</em> melihat chat pesan langsung maupun obrolan grup pengguna lain demi menjaga privasi dan kerahasiaan percakapan.</li></ul>',
                'color' => 'violet',
                'is_pinned' => true,
                'tags' => ['Superadmin', 'Privasi', 'Organisasi'],
            ]
        );
    }
}
