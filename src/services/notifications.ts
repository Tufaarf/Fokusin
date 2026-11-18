import { create } from "zustand";
import { api } from "./api";

export type NotificationType =
  | "message"
  | "reminder"
  | "task"
  | "info"
  | "success"
  | "error"
  | "warning";

export interface ToastItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  senderName?: string;
  roomName?: string;
  roomId?: string;
  timestamp: Date;
  duration?: number; // ms, default 5500
  badge?: string;
  actionLabel?: string;
  actionUrl?: string;
  onClick?: () => void;
  saveToHistory?: boolean;
  metadata?: Record<string, any>;
}

export interface StoredNotification {
  id: string | number;
  userId?: string | number;
  title: string;
  message: string;
  type: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

// Gentle Web Audio API synthesizer for notification sounds
export function playNotificationSound(
  type: "message" | "reminder" | "success" | "error" | "warning" | "default" = "default",
) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, now);
    masterGain.connect(ctx.destination);

    if (type === "reminder") {
      // Warm, distinct double chime (A4 -> E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } else if (type === "success") {
      // Crisp pleasant ascending triad (C5 -> E5 -> G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.08);
      gain2.gain.setValueAtTime(0.13, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.28);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(783.99, now + 0.16);
      gain3.gain.setValueAtTime(0.15, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc3.connect(gain3);
      gain3.connect(masterGain);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.4);
    } else if (type === "error") {
      // Discrete gentle low warning frequency (non-harsh)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.24);
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // Pleasant Slack/Apple style two-tone chime for messages (C5 -> G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.28);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(783.99, now + 0.09);
      gain2.gain.setValueAtTime(0.2, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.42);
    }
  } catch {
    // Autoplay or audio context permission fallback
  }
}

// Track IDs that have already triggered a toast to prevent duplicate popups
const notifiedIds = new Set<string>();

interface NotificationState {
  toasts: ToastItem[];
  history: StoredNotification[];
  soundEnabled: boolean;
  isOpen: boolean; // Notification panel open state
  unreadCount: number;

  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  toggleSound: () => void;
  pushToast: (item: Omit<ToastItem, "id" | "timestamp"> & { id?: string }) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;

  notifyMessage: (data: {
    id?: string;
    sender: string;
    text: string;
    roomId: string;
    roomName?: string;
    onClick?: () => void;
  }) => void;

  notifyReminder: (data: {
    id?: string;
    title: string;
    message: string;
    eventDate?: string;
    time?: string;
    hTag?: string;
    onClick?: () => void;
  }) => void;

  fetchHistory: () => Promise<void>;
  markAsRead: (id: string | number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  history: [],
  soundEnabled:
    typeof window !== "undefined" ? localStorage.getItem("fokusin_sound") !== "false" : true,
  isOpen: false,
  unreadCount: 0,

  setIsOpen: (open: boolean) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  toggleSound: () =>
    set((state) => {
      const next = !state.soundEnabled;
      if (typeof window !== "undefined") {
        localStorage.setItem("fokusin_sound", String(next));
      }
      return { soundEnabled: next };
    }),

  pushToast: (item) => {
    const id = item.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Avoid duplicate toasts with identical ID
    if (get().toasts.some((t) => t.id === id)) {
      return id;
    }

    const newToast: ToastItem = {
      ...item,
      id,
      timestamp: new Date(),
      duration: item.duration ?? 5500,
    };

    // Play sound if enabled
    if (get().soundEnabled) {
      playNotificationSound(
        item.type === "reminder"
          ? "reminder"
          : item.type === "success"
            ? "success"
            : item.type === "error"
              ? "error"
              : "message",
      );
    }

    // Add to toasts (keep max 4 active simultaneously to prevent clutter)
    set((state) => {
      const current = state.toasts.filter((t) => t.id !== id);
      const nextToasts = [newToast, ...current].slice(0, 4);

      // Only record messages, reminders, or items explicitly requesting history
      const shouldSave =
        item.saveToHistory ?? (item.type === "message" || item.type === "reminder");
      if (!shouldSave) {
        return { toasts: nextToasts };
      }

      // Also record into in-memory history
      const newHistoryItem: StoredNotification = {
        id,
        title: item.title,
        message: item.message,
        type:
          item.type === "message"
            ? "CHAT_MESSAGE"
            : item.type === "reminder"
              ? "EVENT_REMINDER_H3"
              : item.type.toUpperCase(),
        data: {
          roomId: item.roomId,
          roomName: item.roomName,
          senderName: item.senderName,
          ...item.metadata,
        },
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const updatedHistory = [
        newHistoryItem,
        ...state.history.filter((h) => String(h.id) !== id),
      ].slice(0, 30);
      const unreadCount = updatedHistory.filter((h) => !h.isRead).length;

      return {
        toasts: nextToasts,
        history: updatedHistory,
        unreadCount,
      };
    });

    return id;
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAllToasts: () => {
    set({ toasts: [] });
  },

  notifyMessage: ({ id, sender, text, roomId, roomName, onClick }) => {
    const dedupKey = id ? `msg-${id}` : `msg-${roomId}-${sender}-${text.slice(0, 20)}`;
    if (notifiedIds.has(dedupKey)) {
      return;
    }
    notifiedIds.add(dedupKey);

    // Keep set bounded
    if (notifiedIds.size > 200) {
      const firstEntries = Array.from(notifiedIds).slice(0, 50);
      firstEntries.forEach((k) => notifiedIds.delete(k));
    }

    get().pushToast({
      id: dedupKey,
      type: "message",
      title: sender,
      message: text,
      senderName: sender,
      roomName: roomName || "Pesan Baru",
      roomId,
      actionLabel: "Buka Chat",
      onClick,
    });
  },

  notifyReminder: ({ id, title, message, eventDate, time, hTag, onClick }) => {
    const dedupKey = id ? `rem-${id}` : `rem-${title}-${eventDate || ""}`;
    if (notifiedIds.has(dedupKey)) {
      return;
    }
    notifiedIds.add(dedupKey);

    if (notifiedIds.size > 200) {
      const firstEntries = Array.from(notifiedIds).slice(0, 50);
      firstEntries.forEach((k) => notifiedIds.delete(k));
    }

    get().pushToast({
      id: dedupKey,
      type: "reminder",
      title: hTag ? `Pengingat ${hTag}: ${title}` : title,
      message:
        message ||
        (eventDate
          ? `Jadwal pada ${eventDate} ${time ? `pukul ${time}` : ""}`
          : "Agenda mendatang."),
      actionLabel: "Lihat Kalender",
      metadata: { eventDate, time, hTag },
      onClick,
    });
  },

  fetchHistory: async () => {
    try {
      const res = await api.notifications.list();
      if (res?.data && Array.isArray(res.data)) {
        const history: StoredNotification[] = res.data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          title: item.title,
          message: item.message,
          type: item.type,
          data: item.data,
          isRead: Boolean(item.is_read),
          createdAt: item.created_at,
        }));
        const unreadCount = history.filter((h) => !h.isRead).length;
        set({ history, unreadCount });
      }
    } catch {
      // Fallback: keep existing history
    }
  },

  markAsRead: async (id: string | number) => {
    set((state) => {
      const history = state.history.map((h) =>
        String(h.id) === String(id) ? { ...h, isRead: true } : h,
      );
      const unreadCount = history.filter((h) => !h.isRead).length;
      return { history, unreadCount };
    });
    try {
      await api.notifications.markAsRead(id);
    } catch {
      // Offline fallback
    }
  },

  markAllAsRead: async () => {
    set((state) => ({
      history: state.history.map((h) => ({ ...h, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await api.notifications.markAllAsRead();
    } catch {
      // Offline fallback
    }
  },
}));

export type ToastOptions = Partial<Omit<ToastItem, "id" | "timestamp">>;

export const toast = {
  success: (message: string, title: string = "Berhasil", options?: ToastOptions) =>
    useNotificationStore.getState().pushToast({
      type: "success",
      title,
      message,
      duration: 4500,
      badge: "Berhasil",
      ...options,
    }),

  error: (message: string, title: string = "Terjadi Kesalahan", options?: ToastOptions) =>
    useNotificationStore.getState().pushToast({
      type: "error",
      title,
      message,
      duration: 5500,
      badge: "Error",
      ...options,
    }),

  warning: (message: string, title: string = "Peringatan", options?: ToastOptions) =>
    useNotificationStore.getState().pushToast({
      type: "warning",
      title,
      message,
      duration: 5000,
      badge: "Peringatan",
      ...options,
    }),

  info: (message: string, title: string = "Informasi", options?: ToastOptions) =>
    useNotificationStore.getState().pushToast({
      type: "info",
      title,
      message,
      duration: 4500,
      badge: "Info",
      ...options,
    }),

  custom: (item: Omit<ToastItem, "id" | "timestamp"> & { id?: string }) =>
    useNotificationStore.getState().pushToast(item),

  dismiss: (id: string) => useNotificationStore.getState().dismissToast(id),
  clear: () => useNotificationStore.getState().clearAllToasts(),
};

// Safe fallback: redirect any native alert(...) in browser to custom toast
if (typeof window !== "undefined") {
  (window as any).alert = (message?: any) => {
    toast.info(String(message ?? ""), "Notifikasi");
  };
}
