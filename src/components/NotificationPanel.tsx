import {
  Bell,
  BellOff,
  BellRing,
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useNotificationStore } from "../services/notifications";
import { useAppStore } from "../store";
import { cn } from "./ui";

export function NotificationPanel() {
  const navigate = useNavigate();
  const { events, chats, currentUser } = useAppStore();
  const {
    isOpen,
    setIsOpen,
    soundEnabled,
    toggleSound,
    history,
    unreadCount,
    markAsRead,
    markAllAsRead,
    notifyMessage,
    notifyReminder,
    fetchHistory,
  } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<"all" | "messages" | "reminders">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync notification history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Click outside to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Derive upcoming H-3 reminders from calendar events in store
  const upcomingReminders = events
    .map((event) => {
      const diff = Math.ceil(
        (new Date(event.date).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000,
      );
      return {
        ...event,
        days: diff,
      };
    })
    .filter((event) => event.days >= 0 && event.days <= 3);

  // Derive unread chats
  const unreadChats = chats.filter((c) => (c.unread || 0) > 0);

  // Combined notifications
  const combinedItems = [
    // 1. History items from backend / realtime
    ...history.map((h) => ({
      id: String(h.id),
      category: h.type === "CHAT_MESSAGE" ? ("messages" as const) : ("reminders" as const),
      title: h.title,
      message: h.message,
      time: new Date(h.createdAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isRead: h.isRead,
      data: h.data,
      type: h.type,
    })),
    // 2. Active calendar reminders if not already in history
    ...upcomingReminders
      .filter((r) => !history.some((h) => h.data?.event_id === r.id || h.title.includes(r.title)))
      .map((r) => ({
        id: `cal-${r.id}`,
        category: "reminders" as const,
        title: `Pengingat H-${r.days}: ${r.title}`,
        message: `Agenda dijadwalkan pada ${new Date(r.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        })} pukul ${r.time}`,
        time: r.time,
        isRead: false,
        data: { event_id: r.id },
        type: "EVENT_REMINDER_H3",
      })),
  ];

  // Filter items based on active tab
  const filteredItems = combinedItems.filter((item) => {
    if (activeTab === "messages") return item.category === "messages";
    if (activeTab === "reminders") return item.category === "reminders";
    return true;
  });

  const handleItemClick = (item: (typeof combinedItems)[0]) => {
    markAsRead(item.id);
    setIsOpen(false);

    if (item.category === "messages") {
      const roomId = item.data?.roomId || item.data?.chat_room_id;
      if (roomId) {
        navigate(`/messages?room=${roomId}`);
      } else {
        navigate("/messages");
      }
    } else {
      if (item.data?.task_id || item.type === "TASK_REMINDER_H3") {
        navigate("/projects");
      } else {
        navigate("/calendar");
      }
    }
  };

  const handleTestMessage = () => {
    const colleagues = [
      {
        name: "Naya Putri",
        room: "Orbit Mobile App",
        roomId: "chat-orbit",
        text: "Halo, progress integrasi API payment gateway sudah siap direview ya!",
      },
      {
        name: "Alif Rahman",
        room: "Atlas Website",
        roomId: "chat-atlas",
        text: "Desain komponen landing page baru sudah update di board #TASK-208.",
      },
      {
        name: "Sarah Kusuma",
        room: "Growth Experiments",
        roomId: "chat-growth",
        text: "Data analitik konversi onboarding minggu ini naik 18% 🎉",
      },
    ];
    const pick = colleagues[Math.floor(Math.random() * colleagues.length)];

    notifyMessage({
      sender: pick.name,
      text: pick.text,
      roomId: pick.roomId,
      roomName: pick.room,
      onClick: () => navigate(`/messages?room=${pick.roomId}`),
    });
  };

  const handleTestReminder = () => {
    const testReminders = [
      { title: "Review Sprint & Demo Orbit v1.0", hTag: "H-2", date: "Besok", time: "10:00 WIB", isTask: false },
      { title: "Selesaikan Integrasi API Payment Gateway", hTag: "H-3", date: "3 hari lagi", time: "23:59 WIB", isTask: true, projectName: "Orbit Mobile App" },
      { title: "Presentasi Growth Campaign Q4", hTag: "H-1", date: "Hari Ini", time: "14:00 WIB", isTask: false },
      { title: "Audit Keamanan & Penetrasi Server", hTag: "H-3", date: "3 hari lagi", time: "18:00 WIB", isTask: true, projectName: "Core Infrastructure" },
      { title: "Weekly Sync Tech Architecture", hTag: "H-3", date: "Kamis", time: "09:30 WIB", isTask: false },
    ];
    const pick = testReminders[Math.floor(Math.random() * testReminders.length)];

    notifyReminder({
      title: `Pengingat ${pick.hTag}: ${pick.title}`,
      message: pick.isTask
        ? `Tugas pada project '${pick.projectName}' jatuh tempo ${pick.date}. Segera selesaikan sebelum batas waktu.`
        : `Agenda dijadwalkan ${pick.date} pukul ${pick.time}. Siapkan materi Anda.`,
      hTag: pick.hTag,
      eventDate: pick.date,
      time: pick.time,
      onClick: () => navigate(pick.isTask ? "/projects" : "/calendar"),
    });
  };

  const totalBadges =
    unreadCount + upcomingReminders.length + unreadChats.reduce((a, b) => a + (b.unread || 0), 0);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative rounded-lg border p-2 transition",
          isOpen
            ? "border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300"
            : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:text-zinc-400",
        )}
        title="Pusat Notifikasi & Reminder"
        aria-label="Buka notifikasi"
      >
        <Bell size={16} />
        {totalBadges > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-zinc-950">
            {totalBadges > 99 ? "99+" : totalBadges}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Pusat Notifikasi"
          className={cn(
            "fixed inset-x-3 top-16 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl backdrop-blur-xl transition-all sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[580px] sm:w-[400px]",
            "border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/60",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Notifikasi
              </span>
              {totalBadges > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
                  {totalBadges} Baru
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg text-xs transition",
                  soundEnabled
                    ? "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
                    : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900",
                )}
                title={
                  soundEnabled
                    ? "Suara notifikasi aktif (Klik untuk matikan)"
                    : "Suara notifikasi hening (Klik untuk aktifkan)"
                }
                aria-label="Toggle suara notifikasi"
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>

              {/* Mark All Read */}
              <button
                onClick={markAllAsRead}
                className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                title="Tandai semua telah dibaca"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">Semua Dibaca</span>
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-zinc-200 bg-zinc-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/40">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition",
                activeTab === "all"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300",
              )}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition",
                activeTab === "messages"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300",
              )}
            >
              Pesan
            </button>
            <button
              onClick={() => setActiveTab("reminders")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition",
                activeTab === "reminders"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300",
              )}
            >
              Reminder H-3
            </button>
          </div>

          {/* Items List */}
          <div className="max-h-[360px] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
                  <Check size={20} />
                </div>
                <p className="mt-3 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Tidak ada notifikasi baru
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Semua pesan dan reminder agenda Anda telah terupdate.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isMessage = item.category === "messages";
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 p-3.5 transition",
                      item.isRead
                        ? "opacity-60 hover:opacity-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        : "bg-violet-50/30 hover:bg-violet-50/60 dark:bg-violet-950/15 dark:hover:bg-violet-950/30",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                        isMessage
                          ? "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
                          : item.type === "TASK_REMINDER_H3" || item.data?.task_id
                          ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                          : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
                      )}
                    >
                      {isMessage ? (
                        <MessageSquare size={15} />
                      ) : item.type === "TASK_REMINDER_H3" || item.data?.task_id ? (
                        <Clock size={15} />
                      ) : (
                        <BellRing size={15} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-400">{item.time}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {item.message}
                      </p>
                    </div>

                    {!item.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Testing / Quick simulation footer */}
          <div className="border-t border-zinc-200 bg-zinc-50/90 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
                Uji Notifikasi Realtime:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleTestMessage}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-700 shadow-xs transition hover:bg-violet-50 dark:border-violet-900/60 dark:bg-zinc-950 dark:text-violet-300 dark:hover:bg-violet-950/40"
              >
                <MessageSquare size={13} />
                <span>+ Pesan Baru</span>
              </button>
              <button
                onClick={handleTestReminder}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-700 shadow-xs transition hover:bg-amber-50 dark:border-amber-900/60 dark:bg-zinc-950 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                <BellRing size={13} />
                <span>+ Reminder H-3</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
