<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public ChatMessage $message)
    {
    }

    public function broadcastOn(): array
    {
        $channels = [
            new Channel('chat.' . $this->message->chat_room_id),
            new Channel('chat.messages'),
        ];

        if ($this->message->chatRoom && $this->message->chatRoom->participants) {
            foreach ($this->message->chatRoom->participants as $participant) {
                $channels[] = new Channel('user.' . $participant->id);
            }
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => (string) $this->message->id,
            'chat_room_id' => $this->message->chat_room_id,
            'chat_room_name' => $this->message->chatRoom?->name ?? 'Chat',
            'chat_room_type' => $this->message->chatRoom?->type ?? 'group',
            'sender' => $this->message->sender?->name ?? 'User',
            'sender_id' => $this->message->user_id,
            'text' => $this->message->message,
            'time' => $this->message->created_at ? $this->message->created_at->format('H:i') : date('H:i'),
            'metadata' => $this->message->metadata ?? [],
            'created_at' => $this->message->created_at?->toISOString() ?? now()->toISOString(),
        ];
    }
}
