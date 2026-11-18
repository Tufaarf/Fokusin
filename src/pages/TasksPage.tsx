import { Calendar, CheckCircle2, CircleDashed, Filter, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { ProjectMembersModal } from "../components/ProjectMembersModal";
import { Badge, Button, Card, cn } from "../components/ui";
import { useAppStore } from "../store";
import { filterUserTasks } from "../utils/taskFilter";

export function TasksPage() {
  const { projects, tasks, currentUser } = useAppStore();
  const [selected, setSelected] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<string | null>(null);

  // Filter tasks: hanya task milik kita (assignee) atau task yang berada di project kita
  const userTasks = useMemo(
    () => filterUserTasks(tasks, projects, currentUser),
    [tasks, projects, currentUser],
  );

  const visible = useMemo(
    () =>
      selected === "all" ? userTasks : userTasks.filter((task) => task.projectId === selected),
    [selected, userTasks],
  );

  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-zinc-500">Semua pekerjaan aktif.</p>
        <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-6 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
          <button
            onClick={() => setSelected("all")}
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs font-medium lg:w-full",
              selected === "all"
                ? "bg-zinc-200/70 dark:bg-zinc-800"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900",
            )}
          >
            <span className="flex items-center gap-2">
              <CircleDashed size={14} /> Semua tasks
            </span>
            <span>{userTasks.length}</span>
          </button>
          <p className="hidden px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 lg:block">
            By project
          </p>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelected(project.id)}
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs lg:w-full",
                selected === project.id
                  ? "bg-zinc-200/70 font-medium dark:bg-zinc-800"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate">{project.name}</span>
              </span>
              <span>{userTasks.filter((task) => task.projectId === project.id).length}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              {selected === "all"
                ? "Semua tasks"
                : projects.find((item) => item.id === selected)?.name}
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              {visible.filter((task) => task.status !== "done").length} belum selesai
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected !== "all" && (
              <Button
                variant="secondary"
                onClick={() => setSelectedProjectForMembers(selected)}
                title="Kelola anggota project"
              >
                <Users size={14} /> Anggota ({projects.find((item) => item.id === selected)?.members.length || 0})
              </Button>
            )}
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={14} /> Task baru
            </Button>
          </div>
        </div>
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_130px_110px_100px] border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 sm:grid">
            <span>Task</span>
            <span>Assignee</span>
            <span>Due date</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <CircleDashed size={32} className="mb-2 text-zinc-400 dark:text-zinc-600" />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {selected === "all"
                    ? "Belum ada task yang aktif"
                    : "Belum ada task di project ini"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-zinc-400">
                  {selected === "all"
                    ? "Hanya task milik Anda atau yang ada di project Anda yang ditampilkan di sini."
                    : "Tambahkan task baru untuk memulai pekerjaan pada project ini."}
                </p>
                <Button variant="secondary" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus size={13} /> Buat task baru
                </Button>
              </div>
            ) : (
              visible.map((task) => {
                const hasProject = task.projectId && projectIds.has(task.projectId);
                const taskUrl = hasProject
                  ? `/projects/${task.projectId}?taskId=${task.id}`
                  : "/projects";

                return (
                  <Link
                    to={taskUrl}
                    key={task.id}
                    className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 sm:grid-cols-[1fr_130px_110px_100px] sm:items-center"
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                      {task.status === "done" ? (
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-xs font-medium",
                            task.status === "done" && "text-zinc-400 line-through",
                          )}
                        >
                          {task.title}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400">{task.id}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-500">{task.assignee}</span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Calendar size={11} />{" "}
                      {new Date(task.dueDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <Badge className="w-fit capitalize">
                      {task.status === "progress" ? "On Progress" : task.status}
                    </Badge>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>
      {isCreateOpen && (
        <CreateTaskModal
          projectId={selected === "all" ? undefined : selected}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
      {selectedProjectForMembers && (
        <ProjectMembersModal
          projectId={selectedProjectForMembers}
          onClose={() => setSelectedProjectForMembers(null)}
        />
      )}
    </div>
  );
}
