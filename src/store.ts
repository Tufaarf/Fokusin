import { create } from "zustand";
import { initialChats, initialEvents, initialNotes, initialProjects, initialTasks } from "./data";
import { api } from "./services/api";
import { realtimeSocket } from "./services/echo";
import type {
  CalendarEvent,
  ChatMessage,
  ChatRoom,
  Note,
  Project,
  ReplyPreview,
  Task,
  TaskStatus,
} from "./types";

export type User = {
  id?: string | number;
  name: string;
  username?: string;
  email: string;
  avatar?: string | null;
  role?: string;
  is_superadmin?: boolean;
};

type AppState = {
  projects: Project[];
  tasks: Task[];
  events: CalendarEvent[];
  chats: ChatRoom[];
  notes: Note[];
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  currentUser: User | null;
  isLoading: boolean;
  notesLoading: boolean;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  syncWithBackend: () => Promise<void>;
  syncChats: () => Promise<void>;
  syncNotes: (q?: string, tag?: string) => Promise<void>;
  markAsRead: (chatId: string) => void;
  addReceivedMessage: (chatId: string, messageData: any) => void;
  moveTask: (taskId: string, status: TaskStatus) => void;
  addProject: (name: string, members: string[]) => void;
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, "id">>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addFriend: (email: string) => void;
  addChatParticipant: (chatId: string, identifier: string) => Promise<any>;
  sendMessage: (
    chatId: string,
    text: string,
    replyTo?: ReplyPreview | null,
    isForwarded?: boolean,
    attachment?: any,
  ) => void;
  editMessage: (chatId: string, messageId: string, newText: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string, forEveryone: boolean) => Promise<void>;
  toggleReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  togglePinMessage: (chatId: string, messageId: string) => Promise<void>;
  toggleStarMessage: (chatId: string, messageId: string) => Promise<void>;
  forwardMessage: (targetChatIds: string[], messageText: string) => Promise<void>;
  addProjectMember: (projectId: string, email: string) => Promise<void>;
  removeProjectMember: (projectId: string, emailOrId: string | number) => Promise<void>;
  updateTask: (
    taskId: string,
    descriptionOrUpdates:
      | {
          description?: string;
          attachments?: Task["attachments"];
          assignee?: string;
          status?: TaskStatus;
          priority?: "Low" | "Medium" | "High";
          dueDate?: string;
        }
      | string,
    attachments?: Task["attachments"],
  ) => Promise<void>;
  addTask: (task: {
    projectId: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: "Low" | "Medium" | "High";
    dueDate?: string;
    assignee?: string;
    tags?: string[];
  }) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  addNote: (note: {
    title: string;
    content?: string;
    color?: string;
    isPinned?: boolean;
    tags?: string[];
  }) => Promise<Note>;
  updateNote: (id: string | number, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string | number) => Promise<void>;
  togglePinNote: (id: string | number) => Promise<void>;
  updateProfile: (data: {
    name: string;
    username?: string;
    email: string;
    avatar?: string | null;
    current_password?: string;
    password?: string;
  }) => Promise<void>;
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, password?: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const initialTheme = (): "light" | "dark" =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 menit

export const checkIsSessionExpired = (): boolean => {
  if (typeof window === "undefined") return false;
  const token = window.localStorage.getItem("fokusin_token");
  if (!token) return true;

  const lastActiveStr = window.localStorage.getItem("fokusin_last_active");
  if (!lastActiveStr) return false;

  const lastActive = parseInt(lastActiveStr, 10);
  if (isNaN(lastActive)) return false;

  return Date.now() - lastActive >= SESSION_TIMEOUT_MS;
};

const storedUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem("fokusin_token");
    if (!token) {
      window.localStorage.removeItem("fokusin-user");
      window.localStorage.removeItem("fokusin_last_active");
      return null;
    }

    // Periksa apakah sesi telah kedaluwarsa setelah web ditutup atau tidak aktif lebih dari 15 menit
    if (checkIsSessionExpired()) {
      window.localStorage.removeItem("fokusin_token");
      window.localStorage.removeItem("fokusin-user");
      window.localStorage.removeItem("fokusin_last_active");
      try {
        window.sessionStorage.setItem("fokusin_expired_notice", "1");
      } catch {}
      return null;
    }

    const value = window.localStorage.getItem("fokusin-user");
    return value ? (JSON.parse(value) as User) : null;
  } catch {
    return null;
  }
};

export const resolveChatDisplayName = (
  room: {
    name: string;
    type: string;
    participants?: { id?: string | number; name: string; email?: string }[];
    messages?: { sender?: string; mine?: boolean }[];
  },
  currentUser: User | null,
): string => {
  if (room.type !== "direct") return room.name;
  if (!currentUser) return room.name;

  // 1. Jika ada participants, cari lawan chat (peserta yang bukan user saat ini)
  if (room.participants && room.participants.length > 0) {
    const other = room.participants.find(
      (p) =>
        (currentUser.id && String(p.id) !== String(currentUser.id)) ||
        (currentUser.email &&
          p.email &&
          p.email.toLowerCase() !== currentUser.email.toLowerCase()) ||
        (currentUser.name && p.name.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()),
    );
    if (other && other.name) return other.name;
  }

  // 2. Jika nama room sama dengan nama user yang sedang login, carikan nama lawan chat
  const currentUserName = currentUser.name?.trim().toLowerCase();
  const roomName = room.name?.trim().toLowerCase();
  if (currentUserName && roomName === currentUserName) {
    const incomingMsg = room.messages?.find(
      (m) => !m.mine && m.sender && m.sender.trim().toLowerCase() !== currentUserName,
    );
    if (incomingMsg?.sender) {
      return incomingMsg.sender;
    }

    if (currentUser.role !== "superadmin" && !currentUser.is_superadmin) {
      return "Super Admin";
    }
  }

  return room.name;
};

export const useAppStore = create<AppState>((set, get) => ({
  projects: storedUser() ? [] : initialProjects,
  tasks: storedUser() ? [] : initialTasks,
  events: storedUser() ? [] : initialEvents,
  chats: (() => {
    const user = storedUser();
    if (!user) return initialChats;
    if (user.role === "superadmin" || user.is_superadmin) return [];
    return [];
  })(),
  notes: storedUser() ? [] : initialNotes,
  sidebarCollapsed: false,
  theme: initialTheme(),
  currentUser: storedUser(),
  isLoading: false,
  notesLoading: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

  syncWithBackend: async () => {
    const initialToken =
      typeof window !== "undefined" ? window.localStorage.getItem("fokusin_token") : null;
    if (!initialToken || !get().currentUser) {
      return;
    }

    set({ isLoading: true });
    try {
      const [dashRes, projRes, chatRes, notesRes, taskRes, meRes] = await Promise.allSettled([
        api.dashboard.get(),
        api.projects.list(),
        api.chats.list(),
        api.notes.list(),
        api.tasks.list(),
        api.auth.me(),
      ]);

      // Pastikan pengguna belum logout saat request berjalan di background
      const activeToken =
        typeof window !== "undefined" ? window.localStorage.getItem("fokusin_token") : null;
      if (!activeToken || !get().currentUser) {
        return;
      }

      if (meRes.status === "rejected" && (meRes.reason as any)?.status === 401) {
        await get().logout();
        return;
      }

      if (meRes.status === "fulfilled" && meRes.value?.user) {
        const u = meRes.value.user;
        const isSuper =
          u.role === "superadmin" ||
          u.is_superadmin === true ||
          u.email?.toLowerCase().includes("superadmin") ||
          u.email === "admin@fokusin.com";
        const user: User = {
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          avatar: u.avatar,
          role: isSuper ? "superadmin" : (u.role ?? "user"),
          is_superadmin: isSuper,
        };
        window.localStorage.setItem("fokusin-user", JSON.stringify(user));
        set({ currentUser: user });
      }

      if (projRes.status === "fulfilled" && projRes.value?.data) {
        set({ projects: projRes.value.data });
      }

      if (taskRes.status === "fulfilled" && taskRes.value?.data) {
        set({ tasks: taskRes.value.data });
      } else if (dashRes.status === "fulfilled" && dashRes.value?.unfinished_tasks) {
        set({ tasks: dashRes.value.unfinished_tasks });
      }

      if (dashRes.status === "fulfilled" && dashRes.value) {
        if (dashRes.value.events) {
          set({ events: dashRes.value.events });
        }
      }

      if (chatRes.status === "fulfilled" && chatRes.value?.data) {
        const currentUser = get().currentUser;
        const normalizedChats = (chatRes.value.data as ChatRoom[]).map((r) => ({
          ...r,
          name: resolveChatDisplayName(r, currentUser),
        }));
        set({ chats: normalizedChats });
      }

      if (notesRes.status === "fulfilled" && notesRes.value?.data) {
        set({ notes: notesRes.value.data });
      }
    } catch {
      // Offline fallback: retains initial mock data
    } finally {
      set({ isLoading: false });
    }
  },

  syncNotes: async (q?: string, tag?: string) => {
    if (typeof window !== "undefined" && !window.localStorage.getItem("fokusin_token")) return;
    if (!get().currentUser) return;
    set({ notesLoading: true });
    try {
      const res = await api.notes.list(q, tag);
      if (typeof window !== "undefined" && !window.localStorage.getItem("fokusin_token")) return;
      if (!get().currentUser) return;
      if (res?.data && Array.isArray(res.data)) {
        set({ notes: res.data });
      }
    } catch (err) {
      console.warn("Failed to fetch notes from backend, using local store", err);
    } finally {
      set({ notesLoading: false });
    }
  },

  syncChats: async () => {
    if (typeof window !== "undefined" && !window.localStorage.getItem("fokusin_token")) return;
    if (!get().currentUser) return;
    try {
      const res = await api.chats.list();
      if (typeof window !== "undefined" && !window.localStorage.getItem("fokusin_token")) return;
      if (!get().currentUser) return;
      if (res?.data && Array.isArray(res.data)) {
        set((state) => {
          const incomingRooms = (res.data as ChatRoom[]).map((r) => ({
            ...r,
            name: resolveChatDisplayName(r, state.currentUser),
          }));

          // Reconcile with existing chats to preserve pending optimistic messages
          const updatedRooms = incomingRooms.map((incomingRoom) => {
            const existingRoom = state.chats.find((c) => c.id === incomingRoom.id);
            if (!existingRoom) return incomingRoom;

            // Retain any optimistic temporary messages (starting with "m-") not yet in server list
            const pendingOptimistic = existingRoom.messages.filter(
              (m) =>
                m.id.startsWith("m-") &&
                !incomingRoom.messages.some((srv) => srv.text === m.text && srv.mine),
            );

            if (pendingOptimistic.length > 0) {
              return {
                ...incomingRoom,
                messages: [...incomingRoom.messages, ...pendingOptimistic],
              };
            }

            return incomingRoom;
          });

          // Also preserve any newly created local rooms that haven't appeared in backend yet
          const pendingRooms = state.chats.filter(
            (c) =>
              c.id.startsWith("chat-") &&
              !incomingRooms.some((srv) => srv.id === c.id) &&
              c.messages.length === 0,
          );

          const merged = [...updatedRooms, ...pendingRooms];

          // Check if data actually changed to prevent redundant state re-renders
          const hasChanged =
            merged.length !== state.chats.length ||
            merged.some((m, idx) => {
              const prev = state.chats[idx];
              if (!prev || prev.id !== m.id || prev.unread !== m.unread) return true;
              if (prev.messages.length !== m.messages.length) return true;
              const lastPrev = prev.messages.at(-1);
              const lastM = m.messages.at(-1);
              return lastPrev?.id !== lastM?.id || lastPrev?.text !== lastM?.text;
            });

          if (!hasChanged) {
            return state;
          }

          return { chats: merged };
        });
      }
    } catch {
      // Offline fallback: retain current chat state
    }
  },

  markAsRead: (chatId: string) => {
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)),
    }));
    api.chats.markAsRead(chatId).catch(() => {});
  },

  addReceivedMessage: (chatId: string, messageData: any) => {
    set((state) => {
      const chatIndex = state.chats.findIndex((c) => c.id === chatId);
      if (chatIndex === -1) return state;

      const chat = state.chats[chatIndex];
      const msgId = String(messageData.id || `m-${Date.now()}`);

      // Avoid duplicates
      if (chat.messages.some((m) => m.id === msgId)) {
        return state;
      }

      const currentUserId = state.currentUser?.id;
      const isMine =
        messageData.mine ??
        Boolean(
          currentUserId &&
          messageData.sender_id &&
          String(messageData.sender_id) === String(currentUserId),
        );

      const newMsg: ChatMessage = {
        id: msgId,
        sender: messageData.sender ?? "User",
        text: messageData.text ?? messageData.message ?? "",
        time:
          messageData.time ??
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        mine: Boolean(isMine),
        status: "read",
        isDeleted: Boolean(messageData.isDeleted || messageData.metadata?.is_deleted),
        deletedForEveryone: Boolean(
          messageData.deletedForEveryone || messageData.metadata?.deleted_for_everyone,
        ),
        isEdited: Boolean(messageData.isEdited || messageData.metadata?.is_edited),
        editedAt: messageData.editedAt || messageData.metadata?.edited_at,
        isForwarded: Boolean(messageData.isForwarded || messageData.metadata?.is_forwarded),
        replyTo: messageData.replyTo || messageData.metadata?.reply_to || null,
        reactions: messageData.reactions || messageData.metadata?.reactions || [],
        isPinned: Boolean(messageData.isPinned || messageData.metadata?.is_pinned),
        isStarred: Boolean(messageData.isStarred),
        attachment: messageData.attachment,
        metadata: messageData.metadata,
      };

      const newChats = [...state.chats];
      newChats[chatIndex] = {
        ...chat,
        messages: [...chat.messages, newMsg],
        unread: isMine ? chat.unread : chat.unread + 1,
      };

      return { chats: newChats };
    });
  },

  moveTask: (taskId, status) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    }));
    api.tasks.updateStatus(taskId, status).catch(() => {});
  },

  addProject: (name, members) => {
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const newProject: Project = {
      id,
      name,
      color: "#059669",
      members: Array.from(new Set(["you@acme.id", ...members])),
    };

    const newRoom: ChatRoom = {
      id: `chat-${id}`,
      name,
      type: "group",
      projectId: id,
      unread: 0,
      messages: [],
    };

    // Optimistic UI update
    set((state) => ({
      projects: [...state.projects, newProject],
      chats: [...state.chats, newRoom],
    }));

    // Trigger Laravel Atomic Transaction
    api.projects
      .create({
        name,
        color: "#059669",
        member_emails: members.filter(Boolean),
      })
      .then((response) => {
        if (response?.project && response?.chat_room) {
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? response.project : p)),
            chats: state.chats.map((c) => (c.id === `chat-${id}` ? response.chat_room : c)),
          }));
        }
      })
      .catch(() => {});
  },

  addEvent: (event) => {
    const tempId = `EV-${Date.now()}`;
    const newEvent: CalendarEvent = { ...event, id: tempId };

    set((state) => ({ events: [...state.events, newEvent] }));

    api.events
      .create({
        title: event.title,
        event_date: event.date,
        end_date: event.endDate,
        time: event.time,
        type: event.type,
        project_id: event.projectId,
      })
      .then((response) => {
        if (response?.data) {
          set((state) => ({
            events: state.events.map((e) => (e.id === tempId ? response.data : e)),
          }));
        }
      })
      .catch(() => {});
  },

  updateEvent: async (id, updates) => {
    // Optimistic UI update
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));

    try {
      const response = await api.events.update(id, {
        title: updates.title,
        date: updates.date,
        endDate: updates.endDate,
        time: updates.time,
        type: updates.type,
        projectId: updates.projectId,
      });

      if (response?.data) {
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? response.data : e)),
        }));
      }
    } catch (err) {
      console.warn("Failed to update event on server", err);
    }
  },

  deleteEvent: async (id) => {
    // Optimistic UI update
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }));

    try {
      await api.events.delete(id);
    } catch (err) {
      console.warn("Failed to delete event on server", err);
    }
  },

  addFriend: (identifier) => {
    const cleanName = identifier.includes("@") ? identifier.split("@")[0] : identifier.replace(/^@/, "");
    const tempChat: ChatRoom = {
      id: `chat-${Date.now()}`,
      name: cleanName,
      type: "direct",
      unread: 0,
      online: false,
      messages: [],
    };

    set((state) => ({ chats: [...state.chats, tempChat] }));

    api.friends
      .addFriend(identifier)
      .then((response) => {
        if (response?.chat_room) {
          const currentUser = get().currentUser;
          const normalized = {
            ...response.chat_room,
            name: resolveChatDisplayName(response.chat_room, currentUser),
          };
          set((state) => ({
            chats: state.chats.map((c) => (c.id === tempChat.id ? normalized : c)),
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        get().syncChats();
      });
  },

  addChatParticipant: async (chatId, identifier) => {
    const res = await api.chats.addParticipant(chatId, identifier);
    if (res?.participants) {
      set((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, participants: res.participants } : c,
        ),
      }));
    }
    await get().syncChats();
    return res;
  },

  sendMessage: (chatId, text, replyTo, isForwarded, attachment) => {
    const currentUser = get().currentUser;
    const tempMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: currentUser?.name || "You",
      text,
      time: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      mine: true,
      status: "read",
      replyTo: replyTo || null,
      isForwarded: Boolean(isForwarded),
      attachment: attachment || undefined,
      reactions: [],
    };

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, tempMsg],
              unread: 0,
            }
          : chat,
      ),
    }));

    api.chats
      .sendMessage(chatId, text, replyTo?.id, isForwarded, attachment)
      .then((response) => {
        if (response?.data) {
          set((state) => ({
            chats: state.chats.map((chat) =>
              chat.id === chatId
                ? {
                    ...chat,
                    messages: chat.messages.map((m) =>
                      m.id === tempMsg.id ? { ...response.data, mine: true } : m,
                    ),
                  }
                : chat,
            ),
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        get().syncChats();
      });
  },

  editMessage: async (chatId, messageId, newText) => {
    // 1. Optimistic update
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      text: newText,
                      isEdited: true,
                      editedAt: new Date().toISOString(),
                    }
                  : m,
              ),
              pinnedMessage:
                chat.pinnedMessage?.id === messageId
                  ? {
                      ...chat.pinnedMessage,
                      text: newText,
                      isEdited: true,
                    }
                  : chat.pinnedMessage,
            }
          : chat,
      ),
    }));

    // 2. Call backend
    try {
      const res = await api.chats.editMessage(chatId, messageId, newText);
      if (res?.data) {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((m) =>
                    m.id === messageId ? { ...res.data, mine: true } : m,
                  ),
                }
              : chat,
          ),
        }));
      }
    } catch {}
  },

  deleteMessage: async (chatId, messageId, forEveryone) => {
    // 1. Optimistic update
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;

        let updatedMessages: ChatMessage[];
        if (forEveryone) {
          // Replace content with standard WhatsApp deleted indicator
          updatedMessages = chat.messages.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  text: "Pesan ini telah dihapus",
                  isDeleted: true,
                  deletedForEveryone: true,
                  reactions: [],
                  attachment: undefined,
                }
              : m,
          );
        } else {
          // Delete for me: remove from user's view completely
          updatedMessages = chat.messages.filter((m) => m.id !== messageId);
        }

        const isPinnedDeleted = chat.pinnedMessage?.id === messageId;

        return {
          ...chat,
          messages: updatedMessages,
          pinnedMessage: isPinnedDeleted ? null : chat.pinnedMessage,
        };
      }),
    }));

    // 2. Call backend
    try {
      await api.chats.deleteMessage(chatId, messageId, forEveryone);
    } catch {}
  },

  toggleReaction: async (chatId, messageId, emoji) => {
    const currentUser = get().currentUser;
    const userName = currentUser?.name || "You";

    // 1. Optimistic update
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;

        const updatedMessages = chat.messages.map((m) => {
          if (m.id !== messageId) return m;

          const reactions = m.reactions ? [...m.reactions] : [];
          const existingSameEmoji = reactions.find((r) => r.emoji === emoji);
          const hasUserReactedSame = existingSameEmoji?.users.includes(userName);

          // Remove user from all reactions first
          const cleaned = reactions
            .map((r) => ({
              ...r,
              users: r.users.filter((u) => u !== userName),
            }))
            .map((r) => ({ ...r, count: r.users.length }))
            .filter((r) => r.count > 0);

          if (!hasUserReactedSame) {
            // Add reaction
            const target = cleaned.find((r) => r.emoji === emoji);
            if (target) {
              target.users.push(userName);
              target.count = target.users.length;
            } else {
              cleaned.push({
                emoji,
                count: 1,
                users: [userName],
              });
            }
          }

          return {
            ...m,
            reactions: cleaned,
          };
        });

        return {
          ...chat,
          messages: updatedMessages,
        };
      }),
    }));

    // 2. Call backend
    try {
      const res = await api.chats.toggleReaction(chatId, messageId, emoji);
      if (res?.data?.reactions) {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((m) =>
                    m.id === messageId ? { ...m, reactions: res.data.reactions } : m,
                  ),
                }
              : chat,
          ),
        }));
      }
    } catch {}
  },

  togglePinMessage: async (chatId, messageId) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;

        const targetMsg = chat.messages.find((m) => m.id === messageId);
        const willBePinned = !targetMsg?.isPinned;

        const updatedMessages = chat.messages.map((m) => ({
          ...m,
          isPinned: m.id === messageId ? willBePinned : false,
        }));

        return {
          ...chat,
          messages: updatedMessages,
          pinnedMessage: willBePinned
            ? updatedMessages.find((m) => m.id === messageId) || null
            : null,
        };
      }),
    }));

    try {
      await api.chats.togglePin(chatId, messageId);
    } catch {}
  },

  toggleStarMessage: async (chatId, messageId) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;

        return {
          ...chat,
          messages: chat.messages.map((m) =>
            m.id === messageId ? { ...m, isStarred: !m.isStarred } : m,
          ),
        };
      }),
    }));

    try {
      await api.chats.toggleStar(chatId, messageId);
    } catch {}
  },

  forwardMessage: async (targetChatIds, messageText) => {
    const currentUser = get().currentUser;
    const timeNow = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Optimistic addition to all target rooms
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (!targetChatIds.includes(chat.id)) return chat;

        const forwardMsg: ChatMessage = {
          id: `m-fwd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender: currentUser?.name || "You",
          text: messageText,
          time: timeNow,
          mine: true,
          status: "read",
          isForwarded: true,
          reactions: [],
        };

        return {
          ...chat,
          messages: [...chat.messages, forwardMsg],
        };
      }),
    }));

    // 2. Call backend if possible
    if (targetChatIds.length > 0) {
      try {
        await api.chats.forwardMessage(targetChatIds[0], targetChatIds, messageText);
      } catch {}
    }
  },

  addProjectMember: async (projectId: string, email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // Optimistic update
    set((state) => {
      const proj = state.projects.find((p) => p.id === projectId);
      if (!proj) return state;

      if (proj.members.some((m) => m.toLowerCase() === trimmed)) {
        return state;
      }

      const updatedMembers = [...proj.members, trimmed];
      const newDetail = {
        id: `user-${Date.now()}`,
        name: trimmed.split("@")[0],
        email: trimmed,
        role: "member",
      };
      const updatedDetails = proj.member_details
        ? [...proj.member_details, newDetail]
        : [newDetail];

      const updatedChats = state.chats.map((c) => {
        if (c.projectId === projectId) {
          const currentParts = c.participants || [];
          if (!currentParts.some((p) => p.email?.toLowerCase() === trimmed)) {
            return {
              ...c,
              participants: [
                ...currentParts,
                { id: `part-${Date.now()}`, name: trimmed.split("@")[0], email: trimmed },
              ],
            };
          }
        }
        return c;
      });

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? { ...p, members: updatedMembers, member_details: updatedDetails }
            : p,
        ),
        chats: updatedChats,
      };
    });

    try {
      const res = await api.projects.addMember(projectId, { email: trimmed });
      if (res?.project) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === projectId ? { ...p, ...res.project } : p)),
        }));
      }
    } catch (err) {
      try {
        const fresh = await api.projects.get(projectId);
        if (fresh?.data) {
          set((state) => ({
            projects: state.projects.map((p) => (p.id === projectId ? fresh.data : p)),
          }));
        }
      } catch {}
      throw err;
    }
  },

  removeProjectMember: async (projectId: string, emailOrId: string | number) => {
    const identifier = String(emailOrId).trim().toLowerCase();

    // Optimistic update
    set((state) => {
      const proj = state.projects.find((p) => p.id === projectId);
      if (!proj) return state;

      const updatedMembers = proj.members.filter(
        (m) => m.toLowerCase() !== identifier && String(m) !== String(emailOrId),
      );
      const updatedDetails = proj.member_details
        ? proj.member_details.filter(
            (d) =>
              d.email.toLowerCase() !== identifier &&
              String(d.id) !== String(emailOrId) &&
              d.name.toLowerCase() !== identifier,
          )
        : undefined;

      const updatedChats = state.chats.map((c) => {
        if (c.projectId === projectId) {
          return {
            ...c,
            participants: (c.participants || []).filter(
              (p) =>
                p.email?.toLowerCase() !== identifier &&
                String(p.id) !== String(emailOrId) &&
                p.name.toLowerCase() !== identifier,
            ),
          };
        }
        return c;
      });

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? { ...p, members: updatedMembers, member_details: updatedDetails }
            : p,
        ),
        chats: updatedChats,
      };
    });

    try {
      const res = await api.projects.removeMember(projectId, emailOrId);
      if (res?.project) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === projectId ? { ...p, ...res.project } : p)),
        }));
      }
    } catch (err) {
      try {
        const fresh = await api.projects.get(projectId);
        if (fresh?.data) {
          set((state) => ({
            projects: state.projects.map((p) => (p.id === projectId ? fresh.data : p)),
          }));
        }
      } catch {}
      throw err;
    }
  },

  updateTask: async (taskId, descriptionOrUpdates, attachments) => {
    let updates: Partial<Task> = {};
    if (typeof descriptionOrUpdates === "string") {
      updates = { description: descriptionOrUpdates, attachments };
    } else if (descriptionOrUpdates && typeof descriptionOrUpdates === "object") {
      updates = descriptionOrUpdates;
    }

    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task,
      ),
    }));

    try {
      await api.tasks.update(taskId, updates);
    } catch (err) {
      console.warn("Failed to update task in backend:", err);
    }
  },

  addTask: async (taskData) => {
    const existingTasks = get().tasks;
    let maxId = 100;
    for (const t of existingTasks) {
      const match = t.id.match(/^TASK-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    }
    const tempId = `TASK-${maxId + 1}`;

    const newTask: Task = {
      id: tempId,
      projectId: taskData.projectId,
      title: taskData.title,
      description: taskData.description || "",
      status: taskData.status || "todo",
      priority: taskData.priority || "Medium",
      dueDate: taskData.dueDate || new Date(Date.now() + 86400000 * 2).toISOString(),
      assignee: taskData.assignee || get().currentUser?.name || "You",
      tags: taskData.tags && taskData.tags.length > 0 ? taskData.tags : ["Feature"],
      attachments: [],
    };

    set((state) => ({
      tasks: [newTask, ...state.tasks],
    }));

    try {
      const res = await api.tasks.create({
        projectId: newTask.projectId,
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        assignee: newTask.assignee,
        tags: newTask.tags,
      });

      if (res?.data) {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === tempId ? { ...t, ...res.data } : t)),
        }));
        return res.data;
      }
    } catch (err) {
      console.warn("Failed to create task on backend, keeping local optimistic state", err);
    }

    return newTask;
  },

  deleteTask: async (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));
    try {
      await api.tasks.delete(taskId);
    } catch (err) {
      console.warn("Failed to delete task on backend", err);
    }
  },

  addNote: async (noteInput) => {
    const tempId = "note-" + Date.now();
    const newNote: Note = {
      id: tempId,
      title: noteInput.title,
      content: noteInput.content || "",
      color: noteInput.color || "default",
      isPinned: !!noteInput.isPinned,
      tags: noteInput.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      notes: [newNote, ...state.notes],
    }));

    try {
      const res = await api.notes.create({
        title: noteInput.title,
        content: noteInput.content,
        color: noteInput.color,
        is_pinned: noteInput.isPinned,
        tags: noteInput.tags,
      });
      if (res?.data) {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === tempId ? res.data : n)),
        }));
        return res.data;
      }
    } catch (err) {
      console.warn("Could not save note to server, saved locally:", err);
    }
    return newNote;
  },

  updateNote: async (id, updates) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        String(n.id) === String(id) ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n,
      ),
    }));

    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.content !== undefined) payload.content = updates.content;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.isPinned !== undefined) {
        payload.is_pinned = updates.isPinned;
        payload.isPinned = updates.isPinned;
      }
      if (updates.tags !== undefined) payload.tags = updates.tags;

      const res = await api.notes.update(id, payload);
      if (res?.data) {
        set((state) => ({
          notes: state.notes.map((n) => (String(n.id) === String(id) ? res.data : n)),
        }));
      }
    } catch (err) {
      console.warn("Could not update note on server, updated locally:", err);
    }
  },

  deleteNote: async (id) => {
    set((state) => ({
      notes: state.notes.filter((n) => String(n.id) !== String(id)),
    }));

    try {
      await api.notes.delete(id);
    } catch (err) {
      console.warn("Could not delete note on server, removed locally:", err);
    }
  },

  togglePinNote: async (id) => {
    const note = get().notes.find((n) => String(n.id) === String(id));
    if (!note) return;
    const newPinned = !note.isPinned;

    set((state) => ({
      notes: state.notes.map((n) =>
        String(n.id) === String(id)
          ? { ...n, isPinned: newPinned, updatedAt: new Date().toISOString() }
          : n,
      ),
    }));

    try {
      await api.notes.update(id, { is_pinned: newPinned, isPinned: newPinned });
    } catch (err) {
      console.warn("Could not toggle pin on server:", err);
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await api.auth.updateProfile(data);
      if (res?.user) {
        const isSuper =
          res.user.role === "superadmin" ||
          res.user.is_superadmin === true ||
          res.user.email?.toLowerCase().includes("superadmin") ||
          res.user.email === "admin@fokusin.com";

        const user: User = {
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          email: res.user.email,
          avatar: res.user.avatar,
          role: isSuper ? "superadmin" : (res.user.role ?? "user"),
          is_superadmin: isSuper,
        };
        window.localStorage.setItem("fokusin-user", JSON.stringify(user));
        set({ currentUser: user });
      }
    } catch (err) {
      // If server error, rethrow so the UI can display validation error
      throw err;
    }
  },

  login: async (email, password = "password") => {
    const res = await api.auth.login(email, password);
    if (!res?.user) {
      throw new Error("Gagal login, respon user tidak valid.");
    }
    const isSuper =
      res.user.role === "superadmin" ||
      res.user.is_superadmin === true ||
      res.user.email?.toLowerCase().includes("superadmin") ||
      res.user.email === "admin@fokusin.com";

    const user: User = {
      id: res.user.id,
      name: res.user.name,
      username: res.user.username,
      email: res.user.email,
      avatar: res.user.avatar,
      role: isSuper ? "superadmin" : (res.user.role ?? "user"),
      is_superadmin: isSuper,
    };
    window.localStorage.setItem("fokusin-user", JSON.stringify(user));
    window.localStorage.setItem("fokusin_last_active", String(Date.now()));
    window.localStorage.removeItem("fokusin_logout_event");
    set({
      currentUser: user,
      projects: [],
      tasks: [],
      events: [],
      chats: [],
      notes: [],
    });
    await get().syncWithBackend();
  },

  register: async (name, email, password = "password", username?: string) => {
    const res = await api.auth.register(name, email, password, username);
    if (!res?.user) {
      throw new Error("Gagal mendaftar akun baru.");
    }
    const isSuper =
      res.user.role === "superadmin" ||
      res.user.is_superadmin === true ||
      res.user.email?.toLowerCase().includes("superadmin") ||
      res.user.email === "admin@fokusin.com";

    const user: User = {
      id: res.user.id,
      name: res.user.name,
      username: res.user.username,
      email: res.user.email,
      avatar: res.user.avatar,
      role: isSuper ? "superadmin" : (res.user.role ?? "user"),
      is_superadmin: isSuper,
    };
    window.localStorage.setItem("fokusin-user", JSON.stringify(user));
    window.localStorage.setItem("fokusin_last_active", String(Date.now()));
    window.localStorage.removeItem("fokusin_logout_event");
    set({
      currentUser: user,
      projects: [],
      tasks: [],
      events: [],
      chats: [],
      notes: [],
    });
    await get().syncWithBackend();
  },

  logout: async () => {
    // 1. Putuskan koneksi real-time websocket
    realtimeSocket.disconnect();

    // 2. Bersihkan seluruh token dan data sesi dari localStorage seketika
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("fokusin-user");
      window.localStorage.removeItem("fokusin_token");
      window.localStorage.removeItem("fokusin_last_active");
      // Notifikasi ke tab browser lain agar sinkron logout seketika
      window.localStorage.setItem("fokusin_logout_event", String(Date.now()));
    }

    // 3. Reset state Zustand seketika agar UI langsung berpindah dan menu terproteksi
    set({
      currentUser: null,
      projects: initialProjects,
      tasks: initialTasks,
      events: initialEvents,
      chats: initialChats,
      notes: initialNotes,
      isLoading: false,
      notesLoading: false,
    });

    // 4. Kirim sinyal revoke token ke backend secara asinkron
    try {
      await api.auth.logout();
    } catch {
      // Abaikan jika token di server sudah tidak valid atau offline
    }
  },
}));
