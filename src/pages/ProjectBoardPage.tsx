import { Calendar, Circle, MoreHorizontal, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { TaskModal } from "../components/TaskModal";
import { Badge, Button, cn } from "../components/ui";
import { useAppStore } from "../store";
import type { TaskStatus } from "../types";

const columns: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "todo", label: "To-Do", dot: "bg-zinc-400" },
  { id: "progress", label: "On Progress", dot: "bg-blue-500" },
  { id: "review", label: "In Review", dot: "bg-amber-500" },
  { id: "done", label: "Done", dot: "bg-emerald-500" },
];

export function ProjectBoardPage() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { projects, tasks, moveTask } = useAppStore();
  const [dragging, setDragging] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");

  const project = projects.find((item) => item.id === projectId);
  const selectedTask = tasks.find(
    (task) => task.projectId === projectId && task.id === params.get("taskId"),
  );
  const closeModal = () => navigate(`/projects/${projectId}`, { replace: true });
  if (!project)
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">Project tidak ditemukan</p>
        <Button onClick={() => navigate("/projects")} className="mt-4">
          Kembali
        </Button>
      </div>
    );
  const boardTasks = tasks.filter((task) => task.projectId === project.id);
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:mb-6 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
            <span>Projects</span>
            <span>/</span>
            <span>{project.id}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">{boardTasks.length} tasks pada board ini</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex -space-x-2">
            {project.members.slice(0, 3).map((member) => (
              <div
                key={member}
                title={member}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-50 bg-zinc-200 text-[10px] font-semibold dark:border-zinc-950 dark:bg-zinc-800"
              >
                {member[0].toUpperCase()}
              </div>
            ))}
          </div>
          <Button className="flex-1 sm:flex-none">
            <Users size={15} /> {project.members.length} anggota
          </Button>
          <Button
            variant="primary"
            className="flex-1 sm:flex-none"
            onClick={() => {
              setCreateStatus("todo");
              setIsCreateOpen(true);
            }}
          >
            <Plus size={15} /> Task
          </Button>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-zinc-500 md:hidden">
        Geser board ke samping. Gunakan pilihan status pada kartu untuk memindahkan task.
      </p>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:px-0">
        <div className="flex w-max snap-x snap-mandatory gap-3 xl:grid xl:w-auto xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = boardTasks.filter((task) => task.status === column.id);
            return (
              <div
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragging) moveTask(dragging, column.id);
                  setDragging(null);
                }}
                className={cn(
                  "w-[82vw] max-w-[310px] shrink-0 snap-start rounded-xl border border-zinc-200 bg-zinc-100/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40 sm:w-[300px] xl:w-auto xl:max-w-none",
                  dragging && "border-dashed",
                )}
              >
                <div className="flex h-10 items-center gap-2 px-2">
                  <span className={cn("h-2 w-2 rounded-full", column.dot)} />
                  <h2 className="text-xs font-semibold">{column.label}</h2>
                  <span className="ml-1 text-[11px] text-zinc-500">{columnTasks.length}</span>
                  <button
                    onClick={() => {
                      setCreateStatus(column.id);
                      setIsCreateOpen(true);
                    }}
                    title={`Tambah task ke ${column.label}`}
                    className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="min-h-[360px] space-y-2 xl:min-h-[450px]">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => navigate(`/projects/${project.id}?taskId=${task.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          navigate(`/projects/${project.id}?taskId=${task.id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "block w-full cursor-grab rounded-lg border border-zinc-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-zinc-300 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700",
                        dragging === task.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-medium text-zinc-400">{task.id}</span>
                        <Circle
                          size={7}
                          className={
                            task.priority === "High"
                              ? "fill-red-500 text-red-500"
                              : task.priority === "Medium"
                                ? "fill-amber-500 text-amber-500"
                                : "fill-zinc-300 text-zinc-300"
                          }
                        />
                      </div>
                      <p className="mt-2 text-xs font-medium leading-5">{task.title}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[10px] text-zinc-500 dark:border-zinc-900">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />{" "}
                          {new Date(task.dueDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-semibold dark:bg-zinc-900">
                          {task.assignee[0]}
                        </span>
                      </div>
                      <select
                        value={task.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          moveTask(task.id, event.target.value as TaskStatus);
                        }}
                        className="mt-3 h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 md:hidden"
                        aria-label={`Ubah status ${task.title}`}
                      >
                        {columns.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-8 text-center text-xs text-zinc-400 dark:border-zinc-800">
                      <p>Belum ada task</p>
                      <button
                        onClick={() => {
                          setCreateStatus(column.id);
                          setIsCreateOpen(true);
                        }}
                        className="mt-2 text-violet-600 hover:underline dark:text-violet-400"
                      >
                        + Tambah task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selectedTask && <TaskModal task={selectedTask} onClose={closeModal} />}
      {isCreateOpen && (
        <CreateTaskModal
          projectId={project.id}
          defaultStatus={createStatus}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  );
}
