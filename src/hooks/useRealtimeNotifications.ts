import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { realtimeSocket } from "../services/echo";
import { useNotificationStore } from "../services/notifications";
import { resolveChatDisplayName, useAppStore } from "../store";

export function useRealtimeNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppStore((state) => state.currentUser);
  const chats = useAppStore((state) => state.chats);
  const events = useAppStore((state) => state.events);
  const addReceivedMessage = useAppStore((state) => state.addReceivedMessage);
  const notifyMessage = useNotificationStore((state) => state.notifyMessage);
  const notifyReminder = useNotificationStore((state) => state.notifyReminder);

  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialChatSyncRef = useRef<boolean>(true);
  const notifiedRemindersRef = useRef<Set<string>>(new Set());

  // 1. Setup WebSocket subscriptions for realtime events
  useEffect(() => {
    if (!currentUser) return;

    realtimeSocket.connect();
    const unsubscribers: Array<() => void> = [];

    // Helper to handle incoming chat messages
    const handleIncomingMessage = (data: any) => {
      if (!data) return;

      const currentUserId = currentUser?.id;
      const isMine =
        data.mine ||
        (currentUserId && data.sender_id && String(data.sender_id) === String(currentUserId));

      // Don't toast own sent messages
      if (isMine) return;

      const roomId = data.chat_room_id;
      if (!roomId) return;

      // Update zustand store
      addReceivedMessage(roomId, data);

      // Check if user is currently looking at this room in /messages
      const searchParams = new URLSearchParams(window.location.search);
      const activeRoom = searchParams.get("room");
      const isViewingThisChat =
        location.pathname === "/messages" &&
        (!activeRoom || activeRoom === roomId) &&
        !document.hidden;

      // If viewing the exact active thread in foreground, avoid interrupting with floating toast
      if (!isViewingThisChat) {
        const room = chats.find((c) => c.id === roomId);
        const roomName =
          data.chat_room_name || (room ? resolveChatDisplayName(room, currentUser) : "Pesan");

        notifyMessage({
          id: String(data.id || Date.now()),
          sender: data.sender || "Teman Tim",
          text: data.text || data.message || "",
          roomId,
          roomName,
          onClick: () => {
            navigate(`/messages?room=${roomId}`);
          },
        });
      }
    };

    // Helper to handle incoming event reminders
    const handleIncomingReminder = (data: any) => {
      if (!data) return;
      notifyReminder({
        id: String(data.id || Date.now()),
        title: data.title || "Pengingat Agenda",
        message: data.message || "",
        eventDate: data.data?.event_date,
        time: data.data?.time,
        hTag: data.data?.h_tag || "H-3",
        onClick: () => {
          navigate("/calendar");
        },
      });
    };

    // Subscribe to user personal channel (for direct notifications and messages)
    if (currentUser.id) {
      const userChan = `user.${currentUser.id}`;
      unsubscribers.push(realtimeSocket.subscribe(userChan, "message.sent", handleIncomingMessage));
      unsubscribers.push(realtimeSocket.subscribe(userChan, "reminder.h3", handleIncomingReminder));
      unsubscribers.push(
        realtimeSocket.subscribe(userChan, ".reminder.h3", handleIncomingReminder),
      );
    }

    // Subscribe to global notifications channel
    unsubscribers.push(
      realtimeSocket.subscribe("notifications", "reminder.h3", handleIncomingReminder),
    );
    unsubscribers.push(
      realtimeSocket.subscribe("notifications", ".reminder.h3", handleIncomingReminder),
    );

    // Subscribe to global chat messages channel
    unsubscribers.push(
      realtimeSocket.subscribe("chat.messages", "message.sent", handleIncomingMessage),
    );
    unsubscribers.push(
      realtimeSocket.subscribe("chat.messages", ".message.sent", handleIncomingMessage),
    );

    // Subscribe to each individual chat room
    for (const chat of chats) {
      const chan = `chat.${chat.id}`;
      unsubscribers.push(realtimeSocket.subscribe(chan, "message.sent", handleIncomingMessage));
    }

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // cleanup
        }
      });
    };
  }, [
    currentUser,
    chats,
    location.pathname,
    addReceivedMessage,
    notifyMessage,
    notifyReminder,
    navigate,
  ]);

  // 2. Polling Fallback: Detect new incoming messages when store's chats are synced
  useEffect(() => {
    if (!currentUser || chats.length === 0) return;

    if (isInitialChatSyncRef.current) {
      // First populate known messages to prevent spamming toasts on page reload
      chats.forEach((chat) => {
        chat.messages.forEach((m) => knownMessageIdsRef.current.add(m.id));
      });
      isInitialChatSyncRef.current = false;
      return;
    }

    // Inspect for newly arrived messages that weren't in known set
    const currentUserId = currentUser.id;
    const searchParams = new URLSearchParams(window.location.search);
    const activeRoom = searchParams.get("room");

    chats.forEach((chat) => {
      chat.messages.forEach((m) => {
        if (!knownMessageIdsRef.current.has(m.id)) {
          knownMessageIdsRef.current.add(m.id);

          const isMine =
            m.mine ||
            (currentUserId &&
              (m as any).sender_id &&
              String((m as any).sender_id) === String(currentUserId));

          if (!isMine) {
            const isViewingThisChat =
              location.pathname === "/messages" &&
              (!activeRoom || activeRoom === chat.id) &&
              !document.hidden;

            if (!isViewingThisChat) {
              const displayName = resolveChatDisplayName(chat, currentUser);
              notifyMessage({
                id: m.id,
                sender: m.sender || "Teman Tim",
                text: m.text || "",
                roomId: chat.id,
                roomName: displayName,
                onClick: () => {
                  navigate(`/messages?room=${chat.id}`);
                },
              });
            }
          }
        }
      });
    });
  }, [chats, currentUser, location.pathname, notifyMessage, navigate]);

  // 3. Calendar Reminders Polling / Startup check (detect H-3 s/d H-1 events)
  useEffect(() => {
    if (!currentUser || events.length === 0) return;

    const todayStr = new Date().toDateString();
    const today = new Date(todayStr);

    events.forEach((event) => {
      const eventDate = new Date(event.date);
      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);

      // Trigger reminder for events in 1 to 3 days
      if (diffDays >= 1 && diffDays <= 3) {
        const reminderKey = `reminder-${event.id}-${event.date}`;
        if (!notifiedRemindersRef.current.has(reminderKey)) {
          notifiedRemindersRef.current.add(reminderKey);

          // Only notify if not already stored in session to keep it non-intrusive
          const sessionKey = `fokusin_notified_${reminderKey}`;
          if (typeof window !== "undefined" && !sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, "1");

            // Slight delay so it doesn't overlap immediately with page load
            const timer = setTimeout(() => {
              notifyReminder({
                id: reminderKey,
                title: event.title,
                message: `Agenda terjadwal pada ${new Date(event.date).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                })} pukul ${event.time}`,
                hTag: `H-${diffDays}`,
                eventDate: event.date,
                time: event.time,
                onClick: () => {
                  navigate("/calendar");
                },
              });
            }, 1200);

            return () => clearTimeout(timer);
          }
        }
      }
    });
  }, [events, currentUser, notifyReminder, navigate]);
}
