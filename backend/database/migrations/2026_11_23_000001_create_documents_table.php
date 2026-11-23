<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('url');
            $table->string('type', 30)->default('docs'); // docs, sheets, slides, forms, drive
            $table->string('file_id')->nullable();
            $table->text('embed_url')->nullable();
            $table->string('category', 60)->default('Umum');
            $table->text('description')->nullable();
            $table->string('color', 30)->nullable();
            $table->longText('content')->nullable();
            $table->string('sync_status', 30)->default('synced');
            $table->timestamp('last_synced_at')->nullable();
            $table->boolean('is_starred')->default(false);
            $table->timestamp('last_opened_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_starred']);
            $table->index(['user_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
