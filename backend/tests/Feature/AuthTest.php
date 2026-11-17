<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Test login gagal jika email tidak ada di database
     */
    public function test_login_fails_when_user_does_not_exist_in_database(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'ghost_random_user_999@acme.id',
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test login gagal jika password salah
     */
    public function test_login_fails_when_password_is_incorrect(): void
    {
        User::firstOrCreate(
            ['email' => 'realuser@acme.id'],
            ['name' => 'Real User', 'password' => bcrypt('correct_password')]
        );

        $response = $this->postJson('/api/auth/login', [
            'email' => 'realuser@acme.id',
            'password' => 'wrong_password_xyz',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /**
     * Test login berhasil jika email dan password cocok di database
     */
    public function test_login_succeeds_with_valid_credentials(): void
    {
        User::firstOrCreate(
            ['email' => 'realuser@acme.id'],
            ['name' => 'Real User', 'password' => bcrypt('correct_password')]
        );

        $response = $this->postJson('/api/auth/login', [
            'email' => 'realuser@acme.id',
            'password' => 'correct_password',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'name', 'email'],
                'token',
            ]);
    }

    /**
     * Test register gagal jika email sudah terdaftar
     */
    public function test_register_fails_when_email_already_registered(): void
    {
        User::firstOrCreate(
            ['email' => 'existing@acme.id'],
            ['name' => 'Existing User', 'password' => bcrypt('secret123')]
        );

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Another User',
            'email' => 'existing@acme.id',
            'password' => 'secret123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test register berhasil membuat user baru di database MySQL
     */
    public function test_register_creates_new_user_in_mysql(): void
    {
        $uniqueEmail = 'new_' . uniqid() . '@acme.id';

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Budi Santoso',
            'email' => $uniqueEmail,
            'password' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', $uniqueEmail)
            ->assertJsonPath('user.name', 'Budi Santoso');

        $this->assertDatabaseHas('users', ['email' => $uniqueEmail]);
    }
}
