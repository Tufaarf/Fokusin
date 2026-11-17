/**
 * Fokusin Real-time WebSocket Client
 * Ready for Laravel Reverb / Pusher Channels
 */

export interface WebSocketConfig {
  wsHost?: string;
  wsPort?: number;
  wssPort?: number;
  appKey?: string;
  forceTLS?: boolean;
}

export class FokusinSocket {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private channelSubscriptions: Set<string> = new Set();
  private reconnectTimer: number | null = null;
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("fokusin_token");
    }
  }

  connect() {
    if (typeof window === "undefined") return;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const currentHost = window.location.hostname ? window.location.hostname : "localhost";
    const wsHost =
      import.meta.env.VITE_REVERB_HOST && import.meta.env.VITE_REVERB_HOST !== "localhost"
        ? import.meta.env.VITE_REVERB_HOST
        : currentHost;
    const wsPort = import.meta.env.VITE_REVERB_PORT || "8080";
    const appKey = import.meta.env.VITE_REVERB_APP_KEY || "fokusin_key";
    const protocol = import.meta.env.VITE_REVERB_SCHEME === "https" ? "wss" : "ws";

    const url = `${protocol}://${wsHost}:${wsPort}/app/${appKey}?protocol=7&client=js&version=8.4.0&flash=false`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        // Re-subscribe to all active channels
        for (const channel of this.channelSubscriptions) {
          this.sendSubscribe(channel);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventName = payload.event;

          // Respond to ping to keep connection alive
          if (eventName === "pusher:ping") {
            this.socket?.send(JSON.stringify({ event: "pusher:pong", data: {} }));
            return;
          }

          let eventData = payload.data;
          if (typeof eventData === "string") {
            try {
              eventData = JSON.parse(eventData);
            } catch {
              // keep as string
            }
          }

          // Trigger handlers for exact channel+event key
          if (payload.channel) {
            const channelKey = `${payload.channel}:${eventName}`;
            this.listeners.get(channelKey)?.forEach((handler) => handler(eventData));

            const channelKeyNoDot = `${payload.channel}:${eventName.replace(/^\./, "")}`;
            if (channelKeyNoDot !== channelKey) {
              this.listeners.get(channelKeyNoDot)?.forEach((handler) => handler(eventData));
            }
          }

          // Trigger handlers for eventName alone
          const handlers =
            this.listeners.get(eventName) || this.listeners.get(eventName.replace(/^\./, ""));
          if (handlers) {
            handlers.forEach((handler) => handler(eventData));
          }

          // Also trigger wildcard message listeners
          this.listeners
            .get("*")
            ?.forEach((handler) =>
              handler({ event: eventName, channel: payload.channel, data: eventData }),
            );
        } catch {
          // Ignore non-json socket messages (e.g. ping)
        }
      };

      this.socket.onerror = () => {
        // Fallback gracefully without breaking UI
      };

      this.socket.onclose = () => {
        this.socket = null;
        // Reconnect after 10s if tab is still visible
        if (!document.hidden && !this.reconnectTimer) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 10000);
        }
      };
    } catch {
      // Graceful offline fallback
    }
  }

  private sendSubscribe(channel: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: { channel, auth: this.token },
        }),
      );
    }
  }

  subscribe(channel: string, eventName: string, callback: (data: any) => void) {
    this.channelSubscriptions.add(channel);

    const channelKey = `${channel}:${eventName}`;
    if (!this.listeners.has(channelKey)) {
      this.listeners.set(channelKey, new Set());
    }
    this.listeners.get(channelKey)?.add(callback);

    // Also support listening by eventName alone
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)?.add(callback);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendSubscribe(channel);
    } else {
      this.connect();
    }

    return () => {
      this.listeners.get(channelKey)?.delete(callback);
      this.listeners.get(eventName)?.delete(callback);
      if (this.listeners.get(channelKey)?.size === 0) {
        this.listeners.delete(channelKey);
      }
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const realtimeSocket = new FokusinSocket();
