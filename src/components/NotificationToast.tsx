import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Info,
  MessageSquare,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ToastItem, useNotificationStore } from "../services/notifications";
import { cn } from "./ui";

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismissToast = useNotificationStore((state) => state.dismissToast);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(toast.duration || 5500);

  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const interval = 20; // 50 fps update

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const total = toast.duration || 5500;
      const left = remainingTimeRef.current - elapsed;

      if (left <= 0) {
        window.clearInterval(timer);
        dismissToast(toast.id);
      } else {
        setProgress(Math.max(0, (left / total) * 100));
      }
    }, interval);

    return () => {
      window.clearInterval(timer);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    };
  }, [isPaused, toast.duration, toast.id, dismissToast]);

  const handleClick = (e: React.MouseEvent) => {
    // If click was on dismiss button, don't trigger action
    if ((e.target as HTMLElement).closest("button[data-dismiss]")) {
      return;
    }
    if (toast.onClick) {
      toast.onClick();
    }
    dismissToast(toast.id);
  };

  const getAccent = () => {
    switch (toast.type) {
      case "message":
        return {
          icon: MessageSquare,
          iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
          progressBg: "bg-violet-600 dark:bg-violet-500",
          tagBg:
            "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60",
          badge: toast.roomName || "Pesan",
        };
      case "reminder":
        return {
          icon: BellRing,
          iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
          progressBg: "bg-amber-500 dark:bg-amber-400",
          tagBg:
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
          badge: toast.metadata?.hTag || "Pengingat",
        };
      case "task":
        return {
          icon: CalendarDays,
          iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
          progressBg: "bg-indigo-500 dark:bg-indigo-400",
          tagBg:
            "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60",
          badge: "Task",
        };
      case "success":
        return {
          icon: CheckCircle2,
          iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
          progressBg: "bg-emerald-500",
          tagBg:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
          badge: toast.badge || "Berhasil",
        };
      case "error":
        return {
          icon: AlertCircle,
          iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
          progressBg: "bg-rose-500",
          tagBg:
            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
          badge: toast.badge || "Gagal",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
          progressBg: "bg-amber-500",
          tagBg:
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
          badge: toast.badge || "Peringatan",
        };
      case "info":
        return {
          icon: Info,
          iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
          progressBg: "bg-sky-500",
          tagBg:
            "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60",
          badge: toast.badge || "Info",
        };
      default:
        return {
          icon: Info,
          iconBg: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
          progressBg: "bg-zinc-400 dark:bg-zinc-500",
          tagBg:
            "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
          badge: toast.badge || "Info",
        };
    }
  };

  const accent = getAccent();
  const IconComponent = accent.icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleClick}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white/95 p-3.5 shadow-xl shadow-zinc-950/10 backdrop-blur-md transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-zinc-950/15",
        "border-zinc-200/90 dark:border-zinc-800/90 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-black/40",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type Icon with subtle ping pulse */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
              accent.iconBg,
            )}
          >
            <IconComponent size={18} />
          </div>
          {toast.type === "message" && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-600"></span>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 pr-6">
            <span
              className={cn(
                "inline-block max-w-[130px] truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none tracking-wide uppercase",
                accent.tagBg,
              )}
            >
              {accent.badge}
            </span>
            <span className="text-[10px] text-zinc-400">· Baru saja</span>
          </div>

          {toast.title && toast.title !== toast.message && (
            <h4 className="mt-1 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {toast.title}
            </h4>
          )}

          <p
            className={cn(
              "text-xs leading-relaxed text-zinc-600 dark:text-zinc-300",
              toast.title && toast.title !== toast.message ? "mt-0.5 line-clamp-2" : "mt-1.5",
            )}
          >
            {toast.message}
          </p>

          {/* Action indicator - only if explicitly provided */}
          {toast.actionLabel && (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-violet-600 transition group-hover:text-violet-700 dark:text-violet-400 dark:group-hover:text-violet-300">
              <span>{toast.actionLabel}</span>
              <ExternalLink size={12} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          data-dismiss
          onClick={(e) => {
            e.stopPropagation();
            dismissToast(toast.id);
          }}
          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Tutup notifikasi"
        >
          <X size={14} />
        </button>
      </div>

      {/* Subtle bottom progress bar */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn("h-full transition-[width] ease-linear", accent.progressBg)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function NotificationToastContainer() {
  const toasts = useNotificationStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-3 right-3 left-3 z-[60] flex flex-col items-end gap-2.5 sm:top-5 sm:right-5 sm:left-auto sm:w-96"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-full animate-in fade-in-0 slide-in-from-top-3 duration-200"
        >
          <ToastCard toast={toast} />
        </div>
      ))}
    </div>
  );
}
