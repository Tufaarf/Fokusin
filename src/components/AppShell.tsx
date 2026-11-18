import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCog,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";
import { filterUserTasks } from "../utils/taskFilter";
import { NotificationPanel } from "./NotificationPanel";
import { cn } from "./ui";

export type NavItem = {
  label: string;
  to: string;
  icon: any;
  badge?: number | string | null;
  superadminOnly?: boolean;
  description?: string;
};

export type NavCategory = {
  id: string;
  title: string;
  superadminOnly?: boolean;
  items: NavItem[];
};

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser?.role === "superadmin" || currentUser?.is_superadmin;
  const totalUnreadChats = chats.reduce((acc, c) => acc + (c.unread || 0), 0);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Activate global realtime notification listener (messages, reminders)
  useRealtimeNotifications();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const userTasks = useMemo(
    () => filterUserTasks(tasks, projects, currentUser),
    [tasks, projects, currentUser],
  );

  const priorities = [...userTasks]
    .filter((task) => task.status !== "done" && task.priority === "High")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);

  // Grouped Navigation Categories for Desktop & Mobile Drawer
  const navCategories: NavCategory[] = useMemo(() => {
    const categories: NavCategory[] = [
      {
        id: "workspace",
        title: "Workspace",
        items: [
          {
            label: "Dashboard",
            to: "/",
            icon: LayoutDashboard,
            description: "Ringkasan agenda & prioritas",
          },
          {
            label: "Kalender",
            to: "/calendar",
            icon: CalendarDays,
            description: "Jadwal event & deadline",
          },
          {
            label: "Catatan",
            to: "/notes",
            icon: NotebookPen,
            description: "Dokumen & ide cepat",
          },
        ],
      },
      {
        id: "collaboration",
        title: "Kolaborasi",
        items: [
          {
            label: "Proyek",
            to: "/projects",
            icon: Workflow,
            description: "Manajemen tim & board",
          },
          {
            label: "Tasks",
            to: "/tasks",
            icon: CircleCheck,
            description: "Daftar tugas & backlog",
          },
          {
            label: "Pesan",
            to: "/messages",
            icon: MessageSquare,
            badge: totalUnreadChats > 0 ? totalUnreadChats : null,
            description: "Chat & koordinasi langsung",
          },
        ],
      },
    ];

    if (isSuperAdmin) {
      categories.push({
        id: "administration",
        title: "Administrasi Sistem",
        superadminOnly: true,
        items: [
          {
            label: "Kelola User",
            to: "/users",
            icon: Users,
            superadminOnly: true,
            description: "Kelola akun, role, dan hak akses",
          },
        ],
      });
    }

    categories.push({
      id: "account",
      title: "Akun & Profil",
      items: [
        {
          label: "Edit Profil",
          to: "/profile",
          icon: UserCog,
          description: "Pengaturan akun & password",
        },
      ],
    });

    return categories;
  }, [totalUnreadChats, isSuperAdmin]);

  const allNavItems = useMemo(() => navCategories.flatMap((cat) => cat.items), [navCategories]);

  const currentItem = allNavItems.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  );

  const title =
    currentItem?.label ??
    (location.pathname.startsWith("/projects/") ? "Project Board" : "Workspace");

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: "Keluar dari Akun",
      message: "Apakah Anda yakin ingin keluar dari akun Fokusin?",
      confirmText: "Keluar",
      cancelText: "Batal",
      variant: "warning",
    });
    if (confirmed) {
      await logout();
      toast.info("Anda telah keluar dari akun.", "Sesi Berakhir");
      navigate("/login", { replace: true });
    }
  };

  // Primary mobile bottom navigation items (5 distinct comfortable slots)
  const mobilePrimaryItems = [
    { label: "Dashboard", to: "/", icon: LayoutDashboard },
    { label: "Tasks", to: "/tasks", icon: CircleCheck },
    { label: "Proyek", to: "/projects", icon: Workflow },
    {
      label: "Pesan",
      to: "/messages",
      icon: MessageSquare,
      badge: totalUnreadChats > 0 ? totalUnreadChats : null,
    },
  ];

  const isOtherActive = ["/calendar", "/notes", "/users", "/profile"].some((p) =>
    location.pathname.startsWith(p),
  );

  const userInitials = (currentUser?.name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      {/* ========================================================
          DESKTOP SIDEBAR (Categorized Navigation)
         ======================================================== */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-950 lg:flex",
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        {/* Workspace Brand / Header */}
        <div className="flex h-16 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <img
              src="/logo_fokusin.png"
              alt="Fokusin Logo"
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
            />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Fokusin</p>
                <p className="truncate text-[11px] text-zinc-500">Workspace produktivitas</p>
              </div>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            className="ml-auto hidden rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:block"
            title={sidebarCollapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Categorized Navigation Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {navCategories.map((cat, idx) => (
            <div key={cat.id} className="space-y-1">
              {/* Category Header */}
              {!sidebarCollapsed ? (
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                    {cat.title}
                  </span>
                  {cat.superadminOnly && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.2 text-[9px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      Admin
                    </span>
                  )}
                </div>
              ) : (
                idx > 0 && <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
              )}

              {/* Category Items */}
              {cat.items.map(({ label, to, icon: Icon, badge, superadminOnly }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  title={sidebarCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                      isActive
                        ? superadminOnly
                          ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-950/70 dark:text-violet-200"
                          : "bg-zinc-100 text-zinc-950 font-semibold dark:bg-zinc-900 dark:text-white"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200",
                    )
                  }
                >
                  <div className="relative flex items-center justify-center">
                    <Icon size={17} className="shrink-0" />
                    {sidebarCollapsed && badge && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                        {badge}
                      </span>
                    )}
                  </div>

                  {!sidebarCollapsed && <span className="truncate">{label}</span>}

                  {!sidebarCollapsed && badge && (
                    <span className="ml-auto rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {badge}
                    </span>
                  )}

                  {!sidebarCollapsed && superadminOnly && !badge && (
                    <span className="ml-auto rounded border border-violet-200 bg-violet-50 px-1 py-0.2 text-[9px] font-semibold text-violet-600 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                      🛡️
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Priority Widget (when expanded) */}
        {!sidebarCollapsed && priorities.length > 0 && (
          <div className="m-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              <Sparkles size={13} className="text-amber-500" /> Deadline Prioritas
            </div>
            <div className="space-y-1.5">
              {priorities.slice(0, 2).map((task) => (
                <NavLink
                  to={`/tasks`}
                  key={task.id}
                  className="block rounded-md bg-white p-2 text-xs shadow-xs transition hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {new Date(task.dueDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* User Card & Profile Link */}
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div
            className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3 px-1")}
          >
            <Link
              to="/profile"
              title="Buka Pengaturan Profil"
              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700 transition hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {userInitials}
            </Link>

            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <Link
                  to="/profile"
                  className="block truncate text-xs font-semibold hover:text-violet-600 transition"
                >
                  {currentUser?.name}
                </Link>
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[10px] text-zinc-400">{currentUser?.email}</p>
                </div>
              </div>
            )}

            {!sidebarCollapsed && (
              <div className="flex items-center gap-1">
                <Link
                  to="/profile"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                  title="Edit Profil"
                  aria-label="Edit Profil"
                >
                  <UserCog size={15} />
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  title="Keluar"
                  aria-label="Keluar dari Fokusin"
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================
          PAGE WRAPPER & TOP HEADER
         ======================================================== */}
      <div className={cn("transition-all", sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile Hamburger / Quick Drawer Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu size={18} />
            </button>

            <img
              src="/logo_fokusin.png"
              alt="Fokusin Logo"
              className="h-7 w-7 shrink-0 rounded-md object-contain lg:hidden"
            />

            <div>
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{title}</p>
                {isSuperAdmin && (
                  <span className="hidden sm:inline-flex rounded-full bg-violet-100 px-2 py-0.2 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    🛡️ Superadmin
                  </span>
                )}
              </div>
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

            {/* Mobile Direct Avatar to Profile */}
            <Link
              to="/profile"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-zinc-700 transition hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 lg:hidden"
              title="Profil Saya"
            >
              {userInitials}
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto min-w-0 max-w-[1600px] p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ========================================================
          MOBILE BOTTOM NAVIGATION (5 Clean Spacious Buttons)
         ======================================================== */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-5">
          {mobilePrimaryItems.map(({ label, to, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
                  isActive
                    ? "text-violet-600 dark:text-violet-400 font-semibold"
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
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                    {badge && (
                      <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-600 px-1 text-[8px] font-bold text-white">
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className="max-w-full truncate px-1">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* 5th Mobile Button: Menu / Lainnya (Categorized Hub) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={cn(
              "relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
              isOtherActive || mobileMenuOpen
                ? "text-violet-600 dark:text-violet-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
            )}
            aria-label="Buka menu lengkap"
          >
            {(isOtherActive || mobileMenuOpen) && (
              <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-violet-600 dark:bg-violet-400" />
            )}
            <div className="relative">
              <Grid2X2 size={20} strokeWidth={isOtherActive || mobileMenuOpen ? 2.4 : 1.8} />
              {isSuperAdmin && (
                <span className="absolute -top-1 -right-1.5 flex h-2 w-2 rounded-full bg-violet-600 ring-2 ring-white dark:ring-zinc-950" />
              )}
            </div>
            <span className="max-w-full truncate px-1">Menu</span>
          </button>
        </div>
      </nav>

      {/* ========================================================
          MOBILE CATEGORIZED DRAWER / BOTTOM SHEET
         ======================================================== */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-950/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle & Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-sm font-bold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold">{currentUser?.name}</p>
                    {isSuperAdmin && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.2 text-[9px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        Superadmin
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-400">{currentUser?.email}</p>
                </div>
              </div>

              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Categorized List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {navCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {category.title}
                    </p>
                    {category.superadminOnly && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        Akses Superadmin
                      </span>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    {category.items.map(
                      ({ label, to, icon: Icon, badge, description, superadminOnly }) => {
                        const isActive =
                          to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
                        return (
                          <NavLink
                            key={to}
                            to={to}
                            end={to === "/"}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center justify-between rounded-xl p-3 text-left transition",
                              isActive
                                ? superadminOnly
                                  ? "bg-violet-50 border border-violet-200 text-violet-900 dark:bg-violet-950/60 dark:border-violet-900 dark:text-violet-100"
                                  : "bg-zinc-100 border border-zinc-200 text-zinc-950 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                                : "border border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-300",
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                  isActive
                                    ? superadminOnly
                                      ? "bg-violet-600 text-white"
                                      : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                                )}
                              >
                                <Icon size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{label}</p>
                                {description && (
                                  <p className="truncate text-xs text-zinc-400">{description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {badge && (
                                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {badge}
                                </span>
                              )}
                              <ChevronRight size={16} className="text-zinc-400" />
                            </div>
                          </NavLink>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions of Mobile Drawer */}
            <div className="border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={toggleTheme}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/50 py-2.5 text-xs font-semibold text-red-600 shadow-xs hover:bg-red-50 dark:border-red-950/50 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <LogOut size={15} />
                  <span>Keluar Akun</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
