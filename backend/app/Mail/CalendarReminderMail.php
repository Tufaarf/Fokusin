<?php

namespace App\Mail;

use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CalendarReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public CalendarEvent $event,
        public User $recipient,
        public int $daysRemaining,
        public string $hTag,
        public string $appUrl = ''
    ) {
        $this->appUrl = $appUrl ?: config('app.url', 'http://localhost:8000');
    }

    public function envelope(): Envelope
    {
        $senderAddress = config('mail.from.address', 'officialfokusin@gmail.com');
        $senderName = config('mail.from.name', 'Fokusin');

        return new Envelope(
            from: new Address($senderAddress, $senderName),
            subject: "[Pengingat {$this->hTag}] Agenda: {$this->event->title} - Fokusin",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.calendar_reminder',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
