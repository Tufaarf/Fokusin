import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleCheck,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  Workflow,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { useAppStore } from "../store";
import { filterUserTasks } from "../utils/taskFilter";
import { NotificationPanel } from "./NotificationPanel";
import { NotificationToastContainer } from "./NotificationToast";
import { cn } from "./ui";

const nav = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Projects", to: "/projects", icon: Workflow },
  { label: "Tasks", to: "/tasks", icon: CircleCheck },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Notes", to: "/notes", icon: NotebookPen },
];

export function AppShell() {
  const {
    sidebarCollapsed,
    toggleSidebar,
    theme,
    toggleTheme,
    projects,
    tasks,
    events,
    chats,
    currentUser,
    logout,
  } = useAppStore();
  const [now, setNow] = useState(new Date());
  const location = useLocation();
  const navigate = useNavigate();

  // Activate global realtime notification listener (messages, reminders)
  useRealtimeNotifications();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const totalUnreadChats = chats.reduce((acc, c) => acc + (c.unread || 0), 0);
  const reminders = events.filter((event) => {
    const diff = Math.ceil(
      (new Date(event.date).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000,
    );
    return diff >= 1 && diff <= 3;
  });
  const userTasks = useMemo(
    () => filterUserTasks(tasks, projects, currentUser),
    [tasks, projects, currentUser],
  );
  const priorities = [...userTasks]
    .filter((task) => task.status !== "done" && task.priority === "High")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const title =
    nav.find((item) => item.to === location.pathname)?.label ??
    (location.pathname.startsWith("/projects/") ? "Project board" : "Workspace");

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <NotificationToastContainer />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-950 lg:flex",
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        <div className="flex h-16 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold text-white dark:bg-white dark:text-zinc-950">
            F
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3 min-w-0">
              <p className="text-sm font-semibold">Fokusin</p>
              <p className="truncate text-[11px] text-zinc-500">Workspace produktivitas</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto hidden rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:block"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                  isActive
                    ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200",
                )
              }
            >
              <div className="relative flex items-center justify-center">
                <Icon size={17} className="shrink-0" />
                {sidebarCollapsed && label === "Messages" && totalUnreadChats > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                    {totalUnreadChats}
                  </span>
                )}
              </div>
              {!sidebarCollapsed && <span>{label}</span>}
              {!sidebarCollapsed && label === "Messages" && totalUnreadChats > 0 && (
                <span className="ml-auto rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {totalUnreadChats}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="m-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
              <Sparkles size={14} /> Prioritas deadline
            </div>
            <p className="-mt-1 mb-3 text-[10px] leading-4 text-zinc-500">
              Task High Priority dengan deadline terdekat.
            </p>
            <div className="space-y-2">
              {priorities.slice(0, 2).map((task) => {
                const hasProject = task.projectId && projects.some((p) => p.id === task.projectId);
                return (
                  <NavLink
                    to={hasProject ? `/projects/${task.projectId}?taskId=${task.id}` : "/tasks"}
                    key={task.id}
                    className="block rounded-md bg-white p-2 dark:bg-zinc-950"
                  >
                    <p className="truncate text-xs font-medium">{task.title}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {task.id} ·{" "}
                      {new Date(task.dueDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div
            className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3 px-2")}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold dark:bg-zinc-800">
              {currentUser?.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() ?? "U"}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-medium">{currentUser?.name}</p>
                  {(currentUser?.role === "superadmin" || currentUser?.is_superadmin) && (
                    <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      Superadmin
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] text-zinc-500">{currentUser?.email}</p>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200",
                sidebarCollapsed && "hidden",
              )}
              title="Keluar"
              aria-label="Keluar dari Fokusin"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className={cn("transition-all", sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div>
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="hidden text-[11px] text-zinc-500 sm:block">
                {now.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-lg border border-zinc-200 px-2.5 py-1.5 font-mono text-xs font-medium tracking-wider dark:border-zinc-800 sm:block">
              {now.toLocaleTimeString("id-ID")}
            </div>
            <NotificationPanel />
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              aria-label="Ganti tema"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 lg:hidden"
              aria-label="Keluar dari Fokusin"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-[1600px] p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-6">
          {nav.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
                  isActive
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-violet-600 dark:bg-violet-400" />
                  )}
                  <div className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                    {label === "Messages" && totalUnreadChats > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-600 px-1 text-[8px] font-bold text-white">
                        {totalUnreadChats}
                      </span>
                    )}
                  </div>
                  <span className="max-w-full truncate px-1">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
