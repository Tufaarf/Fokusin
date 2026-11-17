<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('project_id', 100);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 30)->default('todo'); // todo, progress, review, done
            $table->string('priority', 30)->default('Medium'); // Low, Medium, High
            $table->dateTime('due_date')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('assignee_name')->nullable();
            $table->json('tags')->nullable();
            $table->timestamps();

            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
            $table->index(['project_id', 'status']);
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
