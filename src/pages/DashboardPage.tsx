import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { CalendarGrid } from "../components/CalendarGrid";
import { Badge, Card } from "../components/ui";
import { resolveChatDisplayName, useAppStore } from "../store";

const today = new Date().toISOString().slice(0, 10);
const after = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function DashboardPage() {
  const { tasks, events, chats, projects, currentUser } = useAppStore();
  const [range, setRange] = useState<[string, string]>([today, after(7)]);
  const urgent = [...tasks]
    .filter((task) => task.status !== "done" && task.priority === "High")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);
  const unfinished = tasks.filter((task) => task.status !== "done").slice(0, 5);
  const unreplied = chats.filter((chat) => chat.unread > 0);
  const filteredEvents = events
    .filter((event) => event.date >= range[0] && event.date <= range[1])
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium text-violet-600 dark:text-violet-400">
            MONDAY WORKSPACE
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Selamat datang kembali.
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Prioritas, agenda, dan percakapan penting dalam satu tempat.
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {tasks.filter((task) => task.status === "done").length} task selesai minggu ini
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} /> Tugas prioritas berdasarkan deadline
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Hanya High Priority, diurutkan dari deadline terdekat.
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {urgent.map((task, index) => (
              <Link
                to={`/projects/${task.projectId}?taskId=${task.id}`}
                key={task.id}
                className="group flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[11px] font-semibold dark:border-zinc-800">
                  0{index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {projects.find((item) => item.id === task.projectId)?.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium">
                    {new Date(task.dueDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-400">{task.assignee}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-3 sm:p-5">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <CalendarGrid events={events} range={range} onRangeChange={setRange} />
            <div className="min-w-0 border-t border-zinc-200 pt-5 dark:border-zinc-800 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Agenda terpilih</h3>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {new Date(range[0]).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    —{" "}
                    {new Date(range[1]).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <Badge>{filteredEvents.length} acara</Badge>
              </div>
              <div className="space-y-2">
                {filteredEvents.length ? (
                  filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex min-w-0 items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-900">
                        <span className="text-[9px] uppercase text-zinc-500">
                          {new Date(event.date).toLocaleDateString("id-ID", { month: "short" })}
                        </span>
                        <span className="text-sm font-semibold">
                          {new Date(event.date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{event.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                          <Clock3 size={11} /> {event.time}
                        </p>
                      </div>
                      <Badge className="shrink-0">{event.type}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                    <CalendarClock size={22} />
                    <p className="mt-2 text-xs">Tidak ada agenda dalam rentang ini</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 size={16} /> Unfinished tasks
            </div>
            <Link
              to="/tasks"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Lihat semua <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {unfinished.map((task) => (
              <Link
                to={`/projects/${task.projectId}?taskId=${task.id}`}
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <span className="h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{task.title}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {task.id} · {task.assignee}
                  </p>
                </div>
                <Badge className="hidden shrink-0 sm:inline-flex">
                  {task.status === "progress" ? "On Progress" : task.status}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare size={16} /> Belum dibalas
            </div>
            <Link
              to="/messages"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Buka chat <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {unreplied.map((chat) => {
              const displayName = resolveChatDisplayName(chat, currentUser);
              return (
                <Link
                  to={`/messages?room=${chat.id}`}
                  key={chat.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold dark:bg-zinc-900">
                    {chat.type === "group"
                      ? "GR"
                      : displayName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{displayName}</p>
                    <p className="mt-1 truncate text-[10px] text-zinc-500">
                      {chat.messages.at(-1)?.text}
                    </p>
                  </div>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1.5 text-[10px] text-white dark:bg-white dark:text-zinc-950">
                    {chat.unread}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
