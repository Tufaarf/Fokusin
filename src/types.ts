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

export type Project = {
  id: string;
  name: string;
  color: string;
  members: string[];
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

export type ChatRoom = {
  id: string;
  name: string;
  type: "direct" | "group";
  projectId?: string;
  unread: number;
  online?: boolean;
  participants?: ChatParticipant[];
  messages: { id: string; sender: string; text: string; time: string; mine?: boolean }[];
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
