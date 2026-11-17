import { Calendar, FolderPlus, Plus, Tag, User as UserIcon, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAppStore } from "../store";
import type { Task, TaskStatus } from "../types";
import { Button, Modal, cn, inputClass } from "./ui";

interface CreateTaskModalProps {
  projectId?: string;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onCreated?: (task: Task) => void;
}

const DEFAULT_TAG_SUGGESTIONS = [
  "Feature",
  "Bug",
  "Design",
  "Frontend",
  "Backend",
  "Refactor",
  "Docs",
];

export function CreateTaskModal({
  projectId: initialProjectId,
  defaultStatus = "todo",
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const { projects, currentUser, addTask } = useAppStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || (projects[0]?.id ?? ""),
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");

  // Default due date: tomorrow formatted as YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [dueDate, setDueDate] = useState<string>(tomorrow.toISOString().split("T")[0]);

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const memberList = activeProject?.members || [];
  const defaultAssignee = currentUser?.name || memberList[0] || "You";
  const [assignee, setAssignee] = useState<string>(defaultAssignee);
  const [customAssignee, setCustomAssignee] = useState("");
  const [isCustomAssignee, setIsCustomAssignee] = useState(false);

  const [tags, setTags] = useState<string[]>(["Feature"]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setCustomTagInput("");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !selectedProjectId) return;

    setIsSubmitting(true);
    try {
      const finalAssignee =
        isCustomAssignee && customAssignee.trim() ? customAssignee.trim() : assignee;

      const created = await addTask({
        projectId: selectedProjectId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        dueDate: new Date(dueDate).toISOString(),
        assignee: finalAssignee,
        tags: tags.length > 0 ? tags : ["Feature"],
      });

      if (onCreated) {
        onCreated(created);
      }
      onClose();
    } catch (err) {
      console.error("Gagal menambahkan task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Tambah Task Baru" onClose={onClose} wide>
      {projects.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
            <FolderPlus size={24} />
          </div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Belum ada project yang dibuat
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            Setiap task harus terhubung ke dalam sebuah project. Silakan buat project baru terlebih
            dahulu sebelum menambahkan task.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
            <Link to="/projects" onClick={onClose}>
              <Button variant="primary">
                <Plus size={14} /> Ke Menu Project
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Selector (if not locked or if multiple projects available) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Project <span className="text-red-500">*</span>
            </label>
            {initialProjectId && activeProject ? (
              <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: activeProject.color }}
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {activeProject.name}
                </span>
                <span className="text-[10px] text-zinc-400">({activeProject.id})</span>
              </div>
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  const proj = projects.find((p) => p.id === e.target.value);
                  if (proj && proj.members.length > 0) {
                    setAssignee(currentUser?.name || proj.members[0]);
                  }
                }}
                className={inputClass}
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Task Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Judul Task <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Contoh: Buat flow onboarding user baru"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Status, Priority, Due Date Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={inputClass}
              >
                <option value="todo">To-Do</option>
                <option value="progress">On Progress</option>
                <option value="review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Prioritas
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "Low" | "Medium" | "High")}
                className={inputClass}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Tenggat Waktu
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Assignee
              </label>
              <button
                type="button"
                onClick={() => setIsCustomAssignee(!isCustomAssignee)}
                className="text-[11px] text-violet-600 hover:underline dark:text-violet-400"
              >
                {isCustomAssignee ? "Pilih dari anggota" : "Input nama lain"}
              </button>
            </div>

            {isCustomAssignee ? (
              <input
                type="text"
                placeholder="Ketik nama atau email penerima tugas..."
                value={customAssignee}
                onChange={(e) => setCustomAssignee(e.target.value)}
                className={inputClass}
              />
            ) : (
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className={inputClass}
              >
                {currentUser?.name && (
                  <option value={currentUser.name}>{currentUser.name} (Saya)</option>
                )}
                {memberList
                  .filter((m) => m !== currentUser?.name && m !== currentUser?.email)
                  .map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                <option value="Unassigned">Unassigned</option>
              </select>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Tags / Kategori
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DEFAULT_TAG_SUGGESTIONS.map((tag) => {
                const isSelected = tags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition",
                      isSelected
                        ? "border border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
                        : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
                    )}
                  >
                    <Tag size={10} />
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tambah tag khusus..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="h-8 flex-1 rounded-md border border-zinc-200 bg-transparent px-2.5 text-xs outline-none dark:border-zinc-800"
              />
              <Button type="button" onClick={handleAddCustomTag} className="h-8 px-3 text-xs">
                <Plus size={12} /> Tambah
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded bg-zinc-200/70 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => toggleTag(t)}
                      className="hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Deskripsi Task
            </label>
            <textarea
              placeholder="Jelaskan kebutuhan, checklist, atau catatan penting..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-transparent p-3 text-xs leading-relaxed outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            />
          </div>

          {/* Buttons */}
          <div className="mt-6 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" onClick={onClose} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!title.trim() || !selectedProjectId || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Menyimpan..." : "Tambah Task"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
