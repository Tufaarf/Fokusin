export type TaskStatus = "todo" | "progress" | "review" | "done";

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "Low" | "Medium" | "High";
  dueDate: string;
  assignee: string;
  tags: string[];
  attachments?: { name: string; type: "image" | "video"; url: string }[];
};

export type ProjectMemberDetail = {
  id: string | number;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  description?: string;
  created_by?: string | number;
  members: string[];
  member_details?: ProjectMemberDetail[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  time: string;
  type: "Meeting" | "Deadline" | "Event";
  projectId?: string;
};

export type ChatParticipant = {
  id: string | number;
  name: string;
  email?: string;
  role?: string;
  avatar?: string | null;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  users: string[];
};

export type ReplyPreview = {
  id: string;
  sender: string;
  text: string;
};

export type ChatMessage = {
  id: string;
  sender: string;
  senderId?: string | number;
  text: string;
  time: string;
  mine?: boolean;
  status?: "sent" | "delivered" | "read";
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isForwarded?: boolean;
  replyTo?: ReplyPreview | null;
  reactions?: MessageReaction[];
  isPinned?: boolean;
  isStarred?: boolean;
  attachment?: {
    name: string;
    type: "image" | "file" | "audio";
    url: string;
    size?: string;
  };
  metadata?: any;
};

export type ChatRoom = {
  id: string;
  name: string;
  type: "direct" | "group";
  projectId?: string;
  unread: number;
  online?: boolean;
  participants?: ChatParticipant[];
  pinnedMessage?: ChatMessage | null;
  messages: ChatMessage[];
};

export type User = {
  id?: string | number;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  is_superadmin?: boolean;
  tasks_count?: number;
  projects_count?: number;
  notes_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type Note = {
  id: string | number;
  userId?: string | number;
  userName?: string;
  userEmail?: string;
  title: string;
  content: string;
  color?: "default" | "amber" | "violet" | "blue" | "emerald" | "rose" | string;
  isPinned?: boolean;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};
