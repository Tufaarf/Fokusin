import { create } from "zustand";
import { initialChats, initialEvents, initialNotes, initialProjects, initialTasks } from "./data";
import { api } from "./services/api";
import type { CalendarEvent, ChatRoom, Note, Project, Task, TaskStatus } from "./types";

export type User = {
  id?: string | number;
  name: string;
  email: string;
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
  addFriend: (email: string) => void;
  sendMessage: (chatId: string, text: string) => void;
  updateTask: (taskId: string, description: string, attachments: Task["attachments"]) => void;
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
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const initialTheme = (): "light" | "dark" =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const storedUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem("fokusin_token");
    if (!token) {
      window.localStorage.removeItem("fokusin-user");
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
  projects: initialProjects,
  tasks: initialTasks,
  events: initialEvents,
  chats: (() => {
    const user = storedUser();
    if (user?.role === "superadmin" || user?.is_superadmin) return [];
    return initialChats.map((c) => ({
      ...c,
      name: resolveChatDisplayName(c, user),
    }));
  })(),
  notes: initialNotes,
  sidebarCollapsed: false,
  theme: initialTheme(),
  currentUser: storedUser(),
  isLoading: false,
  notesLoading: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

  syncWithBackend: async () => {
    set({ isLoading: true });
    try {
      const [dashRes, projRes, chatRes, notesRes, taskRes] = await Promise.allSettled([
        api.dashboard.get(),
        api.projects.list(),
        api.chats.list(),
        api.notes.list(),
        api.tasks.list(),
      ]);

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
    set({ notesLoading: true });
    try {
      const res = await api.notes.list(q, tag);
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
    try {
      const res = await api.chats.list();
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

      const newMsg = {
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

  addFriend: (email) => {
    const tempChat: ChatRoom = {
      id: `chat-${Date.now()}`,
      name: email.split("@")[0],
      type: "direct",
      unread: 0,
      online: false,
      messages: [],
    };

    set((state) => ({ chats: [...state.chats, tempChat] }));

    api.friends
      .addFriend(email)
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

  sendMessage: (chatId, text) => {
    const tempMsg = {
      id: `m-${Date.now()}`,
      sender: "You",
      text,
      time: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      mine: true,
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
      .sendMessage(chatId, text)
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

  updateTask: (taskId, description, attachments) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, description, attachments } : task,
      ),
    }));

    api.tasks.update(taskId, { description, attachments }).catch(() => {});
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
      email: res.user.email,
      role: isSuper ? "superadmin" : (res.user.role ?? "user"),
      is_superadmin: isSuper,
    };
    window.localStorage.setItem("fokusin-user", JSON.stringify(user));
    set({ currentUser: user });
    await get().syncWithBackend();
  },

  register: async (name, email, password = "password") => {
    const res = await api.auth.register(name, email, password);
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
      email: res.user.email,
      role: isSuper ? "superadmin" : (res.user.role ?? "user"),
      is_superadmin: isSuper,
    };
    window.localStorage.setItem("fokusin-user", JSON.stringify(user));
    set({ currentUser: user });
    await get().syncWithBackend();
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } catch {
      // Abaikan jika token di server sudah tidak valid
    } finally {
      window.localStorage.removeItem("fokusin-user");
      window.localStorage.removeItem("fokusin_token");
      set({ currentUser: null });
    }
  },
}));
