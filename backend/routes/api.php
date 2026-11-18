<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Authentication - Rute Publik
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Rute Terproteksi (Harus memiliki Bearer Token Sanctum yang valid di database)
Route::middleware('auth:sanctum')->group(function () {
    // Auth status & logout
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/profile/avatar', [AuthController::class, 'uploadAvatar']);

    // Superadmin User Management
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('/{id}', [UserController::class, 'show']);
        Route::put('/{id}', [UserController::class, 'update']);
        Route::delete('/{id}', [UserController::class, 'destroy']);
    });

    // Dashboard Aggregation & Companion Urgency Logic
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Projects & Database Transaction Auto Create Group Chat
    Route::prefix('projects')->group(function () {
        Route::get('/', [ProjectController::class, 'index']);
        Route::post('/', [ProjectController::class, 'store']); // Atomic Database Transaction
        Route::get('/{id}', [ProjectController::class, 'show']);
        Route::post('/{id}/members', [ProjectController::class, 'addMember']);
        Route::delete('/{id}/members/{memberId}', [ProjectController::class, 'removeMember']);
    });

    // Tasks & Media Upload Handler
    Route::prefix('tasks')->group(function () {
        Route::get('/', [TaskController::class, 'index']);
        Route::post('/', [TaskController::class, 'store']);
        Route::patch('/{id}/status', [TaskController::class, 'updateStatus']);
        Route::put('/{id}', [TaskController::class, 'update']);
        Route::delete('/{id}', [TaskController::class, 'destroy']);
        Route::post('/{id}/media', [TaskController::class, 'uploadMedia']); // Multi-file Media Upload
        Route::post('/{id}/presigned-url', [TaskController::class, 'generatePresignedUrl']);
    });

    // Real-time Chat & WhatsApp-like Actions (Edit, Delete, Forward, React, Pin, Star)
    Route::prefix('chats')->group(function () {
        Route::get('/', [ChatController::class, 'index']);
        Route::get('/{chatId}', [ChatController::class, 'show']);
        Route::post('/{chatId}/messages', [ChatController::class, 'sendMessage']); // Mention Parser + WebSocket
        Route::put('/{chatId}/messages/{messageId}', [ChatController::class, 'editMessage']);
        Route::delete('/{chatId}/messages/{messageId}', [ChatController::class, 'deleteMessage']);
        Route::post('/{chatId}/messages/{messageId}/react', [ChatController::class, 'toggleReaction']);
        Route::post('/{chatId}/messages/{messageId}/pin', [ChatController::class, 'togglePin']);
        Route::post('/{chatId}/messages/{messageId}/star', [ChatController::class, 'toggleStar']);
        Route::post('/{chatId}/messages/forward', [ChatController::class, 'forwardMessage']);
        Route::post('/{chatId}/read', [ChatController::class, 'markAsRead']);
    });

    // Friends
    Route::prefix('friends')->group(function () {
        Route::post('/add', [FriendController::class, 'addFriend']);
        Route::get('/search', [FriendController::class, 'search']);
    });

    // Calendar Events
    Route::prefix('events')->group(function () {
        Route::get('/', [CalendarEventController::class, 'index']);
        Route::post('/', [CalendarEventController::class, 'store']);
    });

    // Notes (WYSIWYG Rich Notes)
    Route::prefix('notes')->group(function () {
        Route::get('/', [NoteController::class, 'index']);
        Route::post('/', [NoteController::class, 'store']);
        Route::get('/{id}', [NoteController::class, 'show']);
        Route::put('/{id}', [NoteController::class, 'update']);
        Route::delete('/{id}', [NoteController::class, 'destroy']);
    });

    // Realtime Notifications & Reminders
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::patch('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('/simulate', [NotificationController::class, 'simulate']);
    });
});
