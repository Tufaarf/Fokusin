import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 menit (900.000 ms)
export const LAST_ACTIVE_KEY = "fokusin_last_active";
export const LOGOUT_EVENT_KEY = "fokusin_logout_event";
export const EXPIRED_NOTICE_KEY = "fokusin_expired_notice";

/**
 * Memeriksa apakah sesi pengguna sudah kedaluwarsa berdasarkan aktivitas terakhir.
 * Berguna saat web baru dibuka kembali setelah ditutup atau saat tab aktif kembali.
 */
export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  const token = window.localStorage.getItem("fokusin_token");
  if (!token) return true;

  const lastActiveStr = window.localStorage.getItem(LAST_ACTIVE_KEY);
  if (!lastActiveStr) return false;

  const lastActive = parseInt(lastActiveStr, 10);
  if (isNaN(lastActive)) return false;

  return Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS;
}

/**
 * Mencatat waktu aktivitas terakhir pengguna ke localStorage (dengan throttling).
 */
export function recordActivity(force = false): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  window.localStorage.setItem(LAST_ACTIVE_KEY, String(now));
}

/**
 * Custom Hook untuk memantau aktivitas pengguna dan melakukan logout otomatis:
 * 1. Jika pengguna tidak melakukan aktivitas sama sekali selama 15 menit (inactivity timeout).
 * 2. Jika web ditutup atau di-minimize dan dibuka kembali setelah lebih dari 15 menit.
 * 3. Sinkronisasi multi-tab secara real-time via StorageEvent.
 */
export function useAutoLogout() {
  const currentUser = useAppStore((state) => state.currentUser);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();
  const lastThrottleRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    if (!currentUser) return;

    isLoggingOutRef.current = false;

    // Inisialisasi waktu aktivitas awal jika belum ada
    if (!window.localStorage.getItem(LAST_ACTIVE_KEY)) {
      recordActivity(true);
    }

    const performAutoLogout = async (reason: "inactivity" | "external") => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        if (reason === "inactivity") {
          window.sessionStorage.setItem(EXPIRED_NOTICE_KEY, "1");
        }
        await logout();
      } finally {
        navigate("/login", { replace: true });
        if (reason === "inactivity") {
          toast.warning(
            "Sesi Anda telah berakhir karena tidak ada aktivitas selama 15 menit. Silakan masuk kembali.",
            "Sesi Berakhir",
          );
        }
      }
    };

    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;
      const lastActiveStr = window.localStorage.getItem(LAST_ACTIVE_KEY);
      if (!lastActiveStr) {
        recordActivity(true);
        return;
      }

      const lastActive = parseInt(lastActiveStr, 10);
      if (isNaN(lastActive)) return;

      const elapsed = Date.now() - lastActive;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        performAutoLogout("inactivity");
      }
    };

    // Handler event interaksi pengguna (mouse, keyboard, scroll, touch)
    const handleUserActivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      // Throttle pembaruan localStorage maksimal 2 detik sekali agar performa tetap ringan
      if (now - lastThrottleRef.current > 2000) {
        lastThrottleRef.current = now;
        window.localStorage.setItem(LAST_ACTIVE_KEY, String(now));
      }
    };

    // Handler saat tab kembali aktif atau difokuskan
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };

    // Handler saat tab hendak ditutup/di-unload untuk menyimpan timestamp penutupan web
    const handleBeforeUnload = () => {
      window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    };

    // Handler untuk mendeteksi perubahan antar tab (multi-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOGOUT_EVENT_KEY || (e.key === "fokusin_token" && !e.newValue)) {
        // Tab lain melakukan logout
        performAutoLogout("external");
      } else if (e.key === LAST_ACTIVE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastThrottleRef.current = remoteTime;
        }
      }
    };

    // Cek langsung saat pertama kali hook aktif
    checkInactivity();

    // Jalankan timer berkala setiap 2 detik untuk memeriksa ketidakaktifan
    const intervalTimer = window.setInterval(checkInactivity, 2000);

    // Daftarkan event listener aktivitas pengguna
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.clearInterval(intervalTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [currentUser, logout, navigate]);
}
