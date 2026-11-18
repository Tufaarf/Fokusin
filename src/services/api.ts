/**
 * Fokusin Backend API Client
 * Configured for Laravel 11/12 Sanctum REST API
 * Supports local development, Vite proxy, and network LAN access (e.g. 10.8.132.14:8443)
 */

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let cachedBaseUrl: string | null = null;

function getCandidateBaseUrls(): string[] {
  const candidates: string[] = [];

  const envUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  if (envUrl && envUrl !== "/api" && !candidates.includes(envUrl)) {
    candidates.push(envUrl);
  }

  // 1. If a working base URL was previously confirmed, prioritize it
  if (cachedBaseUrl) {
    candidates.push(cachedBaseUrl);
  }

  // 2. Relative /api (proxied directly by Vite server on port 8443 to backend on port 8000)
  if (!candidates.includes("/api")) {
    candidates.push("/api");
  }

  // 3. Dynamic Network LAN IP (e.g. http://10.8.132.14:8000/api when user visits http://10.8.132.14:8443)
  if (typeof window !== "undefined" && window.location.hostname) {
    const host = window.location.hostname;
    const dynamicDirectUrl = `http://${host}:8000/api`;
    if (!candidates.includes(dynamicDirectUrl)) {
      candidates.push(dynamicDirectUrl);
    }
  }

  // 4. Configured environment URL

  // 5. Default localhost fallback
  const defaultLocal = "http://localhost:8000/api";
  if (!candidates.includes(defaultLocal)) {
    candidates.push(defaultLocal);
  }

  return candidates;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fokusin_token") : null;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const baseUrls = getCandidateBaseUrls();
  let lastError: any = null;

  for (const baseUrl of baseUrls) {
    try {
      const url = `${baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 204) {
        cachedBaseUrl = baseUrl;
        return {} as T;
      }

      // If relative proxy returns 404 (e.g. Vite proxy not yet started), fall through to next candidate
      if (response.status === 404 && baseUrl === "/api" && baseUrls.length > 1) {
        continue;
      }

      cachedBaseUrl = baseUrl;
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new ApiError(
          data.message || `HTTP error! status: ${response.status}`,
          response.status,
          data,
        );
      }

      return data;
    } catch (err: any) {
      // If it is an API response error (e.g. 422 Unprocessable, 401 Unauthorized), do not retry; rethrow immediately
      if (err instanceof ApiError) {
        throw err;
      }
      // If network connection failed ("Failed to fetch"), attempt next candidate URL
      lastError = err;
    }
  }

  throw new ApiError(
    lastError?.message ||
      "Koneksi ke backend gagal. Pastikan server Laravel sedang berjalan: php artisan serve --host=0.0.0.0 --port=8000",
    0,
  );
}

export const api = {
  auth: {
    async login(email: string, password = "password") {
      const res = await request<{ user: any; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res.token) {
        localStorage.setItem("fokusin_token", res.token);
      }
      return res;
    },
    async register(name: string, email: string, password = "password") {
      const res = await request<{ user: any; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (res.token) {
        localStorage.setItem("fokusin_token", res.token);
      }
      return res;
    },
    async logout() {
      try {
        await request("/auth/logout", { method: "POST" });
      } finally {
        localStorage.removeItem("fokusin_token");
      }
    },
    async me() {
      return request<{ user: any }>("/auth/me");
    },
    async updateProfile(data: {
      name: string;
      email: string;
      avatar?: string | null;
      current_password?: string;
      password?: string;
    }) {
      return request<{ message: string; user: any }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async uploadAvatar(file: File) {
      const formData = new FormData();
      formData.append("avatar", file);
      return request<{ message: string; avatar: string; user: any }>("/auth/profile/avatar", {
        method: "POST",
        body: formData,
      });
    },
  },

  dashboard: {
    async get(startDate?: string, endDate?: string) {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request<{
        events: any[];
        unfinished_tasks: any[];
        companion_tasks: any[];
        unreplied_chats: any[];
        summary: {
          done_this_week: number;
          total_active_tasks: number;
        };
      }>(`/dashboard${query}`);
    },
  },

  projects: {
    async list() {
      return request<{ data: any[] }>("/projects");
    },
    async get(id: string) {
      return request<{ data: any }>(`/projects/${id}`);
    },
    /**
     * Atomically creates project, validates members, and creates group chat
     */
    async create(data: { name: string; color?: string; member_emails?: string[] }) {
      return request<{
        message: string;
        project: any;
        chat_room: any;
      }>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    /**
     * Add member to an existing project
     */
    async addMember(projectId: string, payload: { email?: string; user_id?: string | number }) {
      return request<{
        message: string;
        project: any;
      }>(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    /**
     * Remove member from an existing project
     */
    async removeMember(projectId: string, memberId: string | number) {
      return request<{
        message: string;
        project: any;
      }>(`/projects/${projectId}/members/${encodeURIComponent(String(memberId))}`, {
        method: "DELETE",
      });
    },
  },

  tasks: {
    async list(projectId?: string) {
      const query = projectId ? `?project_id=${projectId}` : "";
      return request<{ data: any[] }>(`/tasks${query}`);
    },
    async create(data: {
      projectId: string;
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      dueDate?: string;
      assignee?: string;
      tags?: string[];
    }) {
      return request<{ data: any }>("/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async updateStatus(taskId: string, status: string) {
      return request(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    async update(
      taskId: string,
      data: {
        description?: string;
        attachments?: any[];
        assignee?: string;
        status?: string;
        priority?: string;
        dueDate?: string;
      },
    ) {
      return request(`/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async delete(taskId: string) {
      return request(`/tasks/${taskId}`, {
        method: "DELETE",
      });
    },
    /**
     * Upload multi-file attachments (images/videos)
     */
    async uploadMedia(taskId: string, files: File[]) {
      const formData = new FormData();
      files.forEach((file) => formData.append("files[]", file));
      return request<{ data: any[] }>(`/tasks/${taskId}/media`, {
        method: "POST",
        body: formData,
      });
    },
  },

  chats: {
    async list() {
      return request<{ data: any[] }>("/chats");
    },
    async getRoom(chatId: string) {
      return request<{ data: any }>(`/chats/${chatId}`);
    },
    async sendMessage(
      chatId: string,
      text: string,
      replyToId?: string,
      isForwarded?: boolean,
      attachment?: any,
    ) {
      return request<{
        data: any;
      }>(`/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          reply_to_id: replyToId,
          is_forwarded: isForwarded,
          attachment,
        }),
      });
    },
    async editMessage(chatId: string, messageId: string, message: string) {
      return request<{ message: string; data: any }>(`/chats/${chatId}/messages/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({ message }),
      });
    },
    async deleteMessage(chatId: string, messageId: string, forEveryone: boolean) {
      return request<{ message: string; for_everyone: boolean; data: any }>(
        `/chats/${chatId}/messages/${messageId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ for_everyone: forEveryone }),
        },
      );
    },
    async toggleReaction(chatId: string, messageId: string, emoji: string) {
      return request<{ message: string; data: any }>(
        `/chats/${chatId}/messages/${messageId}/react`,
        {
          method: "POST",
          body: JSON.stringify({ emoji }),
        },
      );
    },
    async togglePin(chatId: string, messageId: string) {
      return request<{ message: string; isPinned: boolean; data: any }>(
        `/chats/${chatId}/messages/${messageId}/pin`,
        {
          method: "POST",
        },
      );
    },
    async toggleStar(chatId: string, messageId: string) {
      return request<{ message: string; isStarred: boolean; data: any }>(
        `/chats/${chatId}/messages/${messageId}/star`,
        {
          method: "POST",
        },
      );
    },
    async forwardMessage(chatId: string, targetRoomIds: string[], text: string) {
      return request<{ message: string; data: any[] }>(`/chats/${chatId}/messages/forward`, {
        method: "POST",
        body: JSON.stringify({ target_room_ids: targetRoomIds, text }),
      });
    },
    async markAsRead(chatId: string) {
      return request(`/chats/${chatId}/read`, { method: "POST" });
    },
  },

  friends: {
    async addFriend(email: string) {
      return request<{ message: string; chat_room: any }>("/friends/add", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    async search(query: string) {
      return request<{ data: any[] }>(`/friends/search?q=${encodeURIComponent(query)}`);
    },
  },

  events: {
    async list(startDate?: string, endDate?: string) {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request<{ data: any[] }>(`/events${query}`);
    },
    async create(event: {
      title: string;
      event_date: string;
      end_date?: string;
      time: string;
      type: "Meeting" | "Deadline" | "Event";
      project_id?: string;
    }) {
      return request<{ data: any }>("/events", {
        method: "POST",
        body: JSON.stringify(event),
      });
    },
  },

  notes: {
    async list(q?: string, tag?: string) {
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      if (tag) params.append("tag", tag);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request<{ data: any[] }>(`/notes${query}`);
    },
    async get(id: string | number) {
      return request<{ data: any }>(`/notes/${id}`);
    },
    async create(data: {
      title: string;
      content?: string;
      color?: string;
      is_pinned?: boolean;
      tags?: string[];
    }) {
      return request<{ message: string; data: any }>("/notes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(
      id: string | number,
      data: Partial<{
        title: string;
        content: string;
        color: string;
        is_pinned: boolean;
        isPinned: boolean;
        tags: string[];
      }>,
    ) {
      return request<{ message: string; data: any }>(`/notes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async delete(id: string | number) {
      return request<{ message: string }>(`/notes/${id}`, {
        method: "DELETE",
      });
    },
  },

  notifications: {
    async list() {
      return request<{ data: any[]; unread_count: number }>("/notifications");
    },
    async markAsRead(id: string | number) {
      return request(`/notifications/${id}/read`, {
        method: "PATCH",
      });
    },
    async markAllAsRead() {
      return request("/notifications/read-all", {
        method: "POST",
      });
    },
    async simulate(data: { type: "reminder" | "message"; title?: string; message?: string }) {
      return request<{ message: string; notification: any }>("/notifications/simulate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  users: {
    async list(params?: { q?: string; role?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.append("q", params.q);
      if (params?.role) searchParams.append("role", params.role);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
      return request<{ data: any[]; total: number }>(`/users${query}`);
    },
    async get(id: string | number) {
      return request<{ data: any }>(`/users/${id}`);
    },
    async create(data: {
      name: string;
      email: string;
      password: string;
      role: string;
      avatar?: string | null;
    }) {
      return request<{ message: string; data: any }>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(
      id: string | number,
      data: {
        name: string;
        email: string;
        password?: string;
        role: string;
        avatar?: string | null;
      },
    ) {
      return request<{ message: string; data: any }>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async delete(id: string | number) {
      return request<{ message: string }>(`/users/${id}`, {
        method: "DELETE",
      });
    },
  },
};
