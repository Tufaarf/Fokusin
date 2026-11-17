<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_attachments', function (Blueprint $table) {
            $table->id();
            $table->string('task_id', 100);
            $table->string('name');
            $table->string('file_path');
            $table->text('url');
            $table->string('file_type', 30)->default('image'); // image, video
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamps();

            $table->foreign('task_id')->references('id')->on('tasks')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_attachments');
    }
};
