<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username', 50)->nullable()->unique()->after('name');
            }
        });

        // Generate random username for all existing users based on their full name
        $existingUsers = DB::table('users')->whereNull('username')->orWhere('username', '')->get();

        foreach ($existingUsers as $user) {
            $rawName = $user->name ?? 'user';
            // Clean name to alphanumeric characters
            $cleanName = Str::lower(preg_replace('/[^a-zA-Z0-9]/', '', $rawName));
            if (empty($cleanName)) {
                $cleanName = 'user';
            }
            // Limit base to 12 chars
            $cleanName = substr($cleanName, 0, 12);

            do {
                $randomSuffix = mt_rand(100, 9999);
                $candidate = $cleanName . '_' . $randomSuffix;
            } while (DB::table('users')->where('username', $candidate)->exists());

            DB::table('users')->where('id', $user->id)->update([
                'username' => $candidate,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'username')) {
                $table->dropColumn('username');
            }
        });
    }
};
