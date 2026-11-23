<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduler Pengingat H-3 (H-3, H-2, H-1) berjalan setiap hari pukul 07:00 pagi untuk agenda kalender & task project
Schedule::command('events:remind-h3')
    ->dailyAt('07:00')
    ->description('Scheduler Pengingat Agenda Kalender dan Task Project H-3');
