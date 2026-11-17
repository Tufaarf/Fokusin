<?php

namespace Tests\Feature;

use App\Models\Note;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class NoteTest extends TestCase
{
    use DatabaseTransactions;

    protected User $user;
    protected User $otherUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::firstOrCreate(
            ['email' => 'note_tester@acme.id'],
            ['name' => 'Note Tester', 'password' => bcrypt('password')]
        );

        $this->otherUser = User::firstOrCreate(
            ['email' => 'other_tester@acme.id'],
            ['name' => 'Other Tester', 'password' => bcrypt('password')]
        );
    }

    /**
     * Test list notes returns only the authenticated user's notes.
     */
    public function test_user_can_list_their_notes(): void
    {
        Note::create([
            'user_id' => $this->user->id,
            'title' => 'Catatan Rahasia User',
            'content' => '<p>Konten rahasia</p>',
            'color' => 'amber',
            'is_pinned' => true,
            'tags' => ['Penting'],
        ]);

        Note::create([
            'user_id' => $this->otherUser->id,
            'title' => 'Catatan User Lain',
            'content' => '<p>Konten orang lain</p>',
            'color' => 'rose',
            'is_pinned' => false,
            'tags' => ['Other'],
        ]);

        $response = $this->actingAs($this->user)->getJson('/api/notes');

        $response->assertStatus(200)
            ->assertJsonFragment(['title' => 'Catatan Rahasia User'])
            ->assertJsonMissing(['title' => 'Catatan User Lain']);
    }

    /**
     * Test creating a note with WYSIWYG rich HTML content.
     */
    public function test_user_can_create_rich_wysiwyg_note(): void
    {
        $payload = [
            'title' => 'Catatan Arsitektur Baru',
            'content' => '<h2>Arsitektur Baru</h2><p>Berikut poin <strong>penting</strong>:</p><ul><li>React 19</li><li>TipTap WYSIWYG</li></ul>',
            'color' => 'violet',
            'is_pinned' => true,
            'tags' => ['Arsitektur', 'Dev'],
        ];

        $response = $this->actingAs($this->user)->postJson('/api/notes', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.title', 'Catatan Arsitektur Baru')
            ->assertJsonPath('data.color', 'violet')
            ->assertJsonPath('data.isPinned', true)
            ->assertJsonPath('data.tags.0', 'Arsitektur');

        $this->assertDatabaseHas('notes', [
            'user_id' => $this->user->id,
            'title' => 'Catatan Arsitektur Baru',
            'color' => 'violet',
            'is_pinned' => 1,
        ]);
    }

    /**
     * Test updating a note.
     */
    public function test_user_can_update_their_note(): void
    {
        $note = Note::create([
            'user_id' => $this->user->id,
            'title' => 'Judul Lama',
            'content' => '<p>Konten lama</p>',
            'color' => 'default',
            'is_pinned' => false,
        ]);

        $updatePayload = [
            'title' => 'Judul Diperbarui',
            'content' => '<p>Konten telah direvisi menggunakan <em>WYSIWYG editor</em></p>',
            'color' => 'emerald',
            'is_pinned' => true,
            'tags' => ['Updated'],
        ];

        $response = $this->actingAs($this->user)->putJson("/api/notes/{$note->id}", $updatePayload);

        $response->assertStatus(200)
            ->assertJsonPath('data.title', 'Judul Diperbarui')
            ->assertJsonPath('data.color', 'emerald')
            ->assertJsonPath('data.isPinned', true);

        $this->assertDatabaseHas('notes', [
            'id' => $note->id,
            'title' => 'Judul Diperbarui',
            'color' => 'emerald',
            'is_pinned' => 1,
        ]);
    }

    /**
     * Test deleting a note.
     */
    public function test_user_can_delete_their_note(): void
    {
        $note = Note::create([
            'user_id' => $this->user->id,
            'title' => 'Catatan untuk Dihapus',
            'content' => '<p>Akan segera dihapus</p>',
        ]);

        $response = $this->actingAs($this->user)->deleteJson("/api/notes/{$note->id}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('notes', [
            'id' => $note->id,
        ]);
    }

    /**
     * Test user cannot update or delete someone else's note.
     */
    public function test_user_cannot_access_other_users_note(): void
    {
        $otherNote = Note::create([
            'user_id' => $this->otherUser->id,
            'title' => 'Catatan Privat Orang Lain',
            'content' => '<p>Tidak boleh diakses</p>',
        ]);

        // Attempt show
        $this->actingAs($this->user)->getJson("/api/notes/{$otherNote->id}")
            ->assertStatus(404);

        // Attempt update
        $this->actingAs($this->user)->putJson("/api/notes/{$otherNote->id}", ['title' => 'Hacked'])
            ->assertStatus(404);

        // Attempt delete
        $this->actingAs($this->user)->deleteJson("/api/notes/{$otherNote->id}")
            ->assertStatus(404);
    }

    /**
     * Test searching notes by query string.
     */
    public function test_user_can_search_notes(): void
    {
        Note::create([
            'user_id' => $this->user->id,
            'title' => 'Dokumentasi REST API',
            'content' => '<p>Panduan rute endpoint laravel</p>',
        ]);

        Note::create([
            'user_id' => $this->user->id,
            'title' => 'Desain Wireframe Figma',
            'content' => '<p>Komponen UI kit</p>',
        ]);

        $response = $this->actingAs($this->user)->getJson('/api/notes?q=REST');

        $response->assertStatus(200)
            ->assertJsonFragment(['title' => 'Dokumentasi REST API'])
            ->assertJsonMissing(['title' => 'Desain Wireframe Figma']);
    }
}
