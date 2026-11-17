<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('project_id', 100)->nullable();
            $table->string('title');
            $table->date('event_date');
            $table->date('end_date')->nullable();
            $table->string('time', 50)->default('09:00');
            $table->string('type', 30)->default('Meeting'); // Meeting, Deadline, Event
            $table->timestamps();

            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
            $table->index(['event_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};
