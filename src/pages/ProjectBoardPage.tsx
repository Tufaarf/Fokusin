import {
  Calendar,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Presentation,
  Search,
  ShieldAlert,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { ProjectMembersModal } from "../components/ProjectMembersModal";
import { TaskModal } from "../components/TaskModal";
import { Badge, Button, cn, inputClass } from "../components/ui";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";
import type { GoogleDocument, GoogleDocumentType, TaskStatus } from "../types";
import { getDocTypeConfig, getGoogleEmbedUrl, parseGoogleDocumentUrl } from "../utils/googleDocs";

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
  const {
    projects,
    tasks,
    moveTask,
    documents,
    addDocument,
    deleteDocument,
    recordOpenDocument,
    currentUser,
    theme,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"tasks" | "documents">("tasks");
  const [dragging, setDragging] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Project Documents States
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("Project");
  const [newDocDescription, setNewDocDescription] = useState("");
  const [newDocAnalysis, setNewDocAnalysis] = useState<ReturnType<
    typeof parseGoogleDocumentUrl
  > | null>(null);

  // Embed Modal State
  const [activeEmbedDoc, setActiveEmbedDoc] = useState<GoogleDocument | null>(null);
  const [embedMode, setEmbedMode] = useState<"edit" | "preview">("edit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [docDarkModeOverride, setDocDarkModeOverride] = useState<boolean | null>(null);
  const isDocDarkMode = docDarkModeOverride !== null ? docDarkModeOverride : theme === "dark";

  const project = projects.find((item) => item.id === projectId);

  // Cek apakah user adalah anggota project
  const isUserProjectMember = useMemo(() => {
    if (!currentUser || !project) return false;
    if (currentUser.is_superadmin || currentUser.role === "superadmin") return true;
    if (project.created_by && String(project.created_by) === String(currentUser.id)) return true;
    if (
      project.members?.some(
        (m) =>
          String(m).toLowerCase() === String(currentUser.name).toLowerCase() ||
          String(m).toLowerCase() === String(currentUser.email).toLowerCase() ||
          String(m) === String(currentUser.id),
      )
    ) {
      return true;
    }
    if (
      project.member_details?.some(
        (m) =>
          String(m.id) === String(currentUser.id) ||
          (m.email && m.email.toLowerCase() === currentUser.email?.toLowerCase()),
      )
    ) {
      return true;
    }
    return false;
  }, [project, currentUser]);

  const selectedTask = tasks.find(
    (task) => task.projectId === projectId && task.id === params.get("taskId"),
  );

  const closeModal = () => navigate(`/projects/${projectId}`, { replace: true });

  // Dokumen yang terikat ke project ini
  const projectDocs = useMemo(() => {
    if (!project) return [];
    return documents.filter((d) => d.projectId === project.id);
  }, [documents, project]);

  const filteredProjectDocs = useMemo(() => {
    if (!docSearchQuery.trim()) return projectDocs;
    const q = docSearchQuery.toLowerCase();
    return projectDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q),
    );
  }, [projectDocs, docSearchQuery]);

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">Project tidak ditemukan</p>
        <Button onClick={() => navigate("/projects")} className="mt-4">
          Kembali
        </Button>
      </div>
    );
  }

  // Proteksi Akses: Hanya anggota project yang dapat mengakses
  if (!isUserProjectMember) {
    return (
      <div className="py-20 text-center">
        <ShieldAlert size={40} className="mx-auto mb-3 text-amber-500" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Akses Terbatas</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Anda bukan anggota dari project ini. Hanya anggota yang terdaftar di dalam project{" "}
          <strong>{project.name}</strong> yang dapat mengakses tasks dan dokumen project ini.
        </p>
        <Button onClick={() => navigate("/projects")} className="mt-5">
          Kembali ke Daftar Project
        </Button>
      </div>
    );
  }

  const boardTasks = tasks.filter((task) => task.projectId === project.id);

  const handleOpenDoc = (doc: GoogleDocument) => {
    recordOpenDocument(doc.id);
    setActiveEmbedDoc(doc);
    setEmbedMode("edit");
    setDocDarkModeOverride(null);
  };

  const handleCloseDoc = () => {
    setActiveEmbedDoc(null);
    setIsFullscreen(false);
    setDocDarkModeOverride(null);
  };

  const handleOpenInNewTab = (url?: string) => {
    const targetUrl = (url || activeEmbedDoc?.url || "").trim();
    if (!targetUrl) return;
    const win = window.open(targetUrl, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      const a = document.createElement("a");
      a.href = targetUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleCopyLink = (url: string, title: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`Tautan "${title}" disalin ke clipboard.`);
  };

  const handleDeleteDoc = async (doc: GoogleDocument) => {
    const confirmed = await confirmDialog({
      title: "Hapus Dokumen dari Project",
      message: `Hapus tautan "${doc.title}" dari project ${project.name}? File asli di Google Drive tidak akan terhapus.`,
      confirmText: "Hapus",
      cancelText: "Batal",
      variant: "danger",
    });

    if (confirmed) {
      await deleteDocument(doc.id);
      if (activeEmbedDoc?.id === doc.id) {
        setActiveEmbedDoc(null);
      }
      toast.info(`Dokumen "${doc.title}" telah dihapus dari project.`);
    }
  };

  const handleSaveAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocUrl.trim()) {
      toast.warning("Harap masukkan link Google Docs/Sheets/Slides.");
      return;
    }
    const parsed = parseGoogleDocumentUrl(newDocUrl);
    if (!parsed.isValid) {
      toast.error(parsed.error || "Link tidak valid.");
      return;
    }
    const finalTitle = newDocTitle.trim() || parsed.suggestedTitle;
    try {
      const created = await addDocument({
        url: newDocUrl.trim(),
        title: finalTitle,
        projectId: project.id,
        projectName: project.name,
        category: newDocCategory.trim() || "Project",
        description: newDocDescription.trim(),
        color:
          parsed.type === "sheets" ? "#0F9D58" : parsed.type === "slides" ? "#F4B400" : "#4285F4",
      });
      setIsAddDocModalOpen(false);
      setNewDocUrl("");
      setNewDocTitle("");
      setNewDocDescription("");
      setNewDocAnalysis(null);
      toast.success(`Dokumen "${finalTitle}" berhasil disertakan ke project.`);
      handleOpenDoc(created);
    } catch {
      toast.error("Gagal menambahkan dokumen.");
    }
  };

  const renderDocIcon = (type: GoogleDocumentType, size: number = 20) => {
    switch (type) {
      case "sheets":
        return (
          <FileSpreadsheet
            size={size}
            className="shrink-0 text-emerald-600 dark:text-emerald-400"
          />
        );
      case "slides":
        return <Presentation size={size} className="shrink-0 text-amber-500 dark:text-amber-400" />;
      default:
        return <FileText size={size} className="shrink-0 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="min-w-0">
      {/* Top Header */}
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
            <span>Projects</span>
            <span>/</span>
            <span>{project.id}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              {project.name}
            </h1>
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: project.color }}
              title={`Warna Project: ${project.name}`}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {boardTasks.length} tasks • {projectDocs.length} dokumen Google terikat • Hanya anggota
            project
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Member Avatars */}
          <button
            type="button"
            onClick={() => setIsMembersModalOpen(true)}
            className="flex -space-x-2 transition hover:opacity-85 focus:outline-none"
            title="Kelola anggota project"
          >
            {project.members.slice(0, 3).map((member) => (
              <div
                key={member}
                title={member}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-50 bg-zinc-200 text-[10px] font-semibold dark:border-zinc-950 dark:bg-zinc-800"
              >
                {member[0].toUpperCase()}
              </div>
            ))}
          </button>
          <Button
            className="flex-1 sm:flex-none text-xs"
            onClick={() => setIsMembersModalOpen(true)}
            title="Kelola anggota project"
          >
            <Users size={14} /> {project.members.length} anggota
          </Button>

          {activeTab === "tasks" ? (
            <Button
              variant="primary"
              className="flex-1 sm:flex-none text-xs"
              onClick={() => {
                setCreateStatus("todo");
                setIsCreateOpen(true);
              }}
            >
              <Plus size={15} /> Task Baru
            </Button>
          ) : (
            <Button
              variant="primary"
              className="flex-1 sm:flex-none text-xs"
              onClick={() => setIsAddDocModalOpen(true)}
            >
              <Plus size={15} /> Tambah Dokumen
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation: Tasks Board vs Dokumen Project */}
      <div className="mb-5 flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
            activeTab === "tasks"
              ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950"
              : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          <LayoutGrid size={14} />
          <span>Tasks Board</span>
          <span className="rounded-full bg-zinc-200/60 px-1.5 py-0.2 text-[10px] font-bold dark:bg-zinc-800">
            {boardTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
            activeTab === "documents"
              ? "bg-violet-600 text-white shadow-sm dark:bg-violet-600"
              : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          <FileText size={14} />
          <span>Dokumen Project</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
              activeTab === "documents"
                ? "bg-white/20 text-white"
                : "bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300",
            )}
          >
            {projectDocs.length}
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: KANBAN TASKS BOARD
         ======================================================== */}
      {activeTab === "tasks" && (
        <div>
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
        </div>
      )}

      {/* ========================================================
          TAB 2: DOKUMEN PROJECT (Hanya Anggota yang Bisa Akses)
         ======================================================== */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {/* Search Bar & Add Action */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                placeholder="Cari dokumen dalam project ini..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className={cn(inputClass, "pl-9 h-9 text-xs")}
              />
              {docSearchQuery && (
                <button
                  onClick={() => setDocSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <Button
              variant="primary"
              onClick={() => setIsAddDocModalOpen(true)}
              className="text-xs self-start sm:self-auto"
            >
              <Plus size={14} /> Sertakan Dokumen Baru
            </Button>
          </div>

          {/* Grid Dokumen Project */}
          {filteredProjectDocs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProjectDocs.map((doc) => {
                const typeCfg = getDocTypeConfig(doc.type);
                return (
                  <div
                    key={doc.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-800"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 p-3.5 pb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800">
                          {renderDocIcon(doc.type, 20)}
                        </div>
                        <div className="min-w-0">
                          <h4
                            onClick={() => handleOpenDoc(doc)}
                            className="cursor-pointer truncate text-sm font-semibold text-zinc-900 transition hover:text-violet-600 dark:text-zinc-100 dark:group-hover:text-violet-400"
                            title={doc.title}
                          >
                            {doc.title}
                          </h4>
                          <span className="inline-block text-[10px] font-medium text-zinc-400">
                            {doc.category || "Project"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        title="Hapus dari project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Preview Body (Click to Embed View) */}
                    <div
                      onClick={() => handleOpenDoc(doc)}
                      className="relative mx-3.5 my-2 flex h-32 cursor-pointer flex-col justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/90 p-4 transition group-hover:border-violet-200 group-hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:group-hover:bg-zinc-950"
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5"
                        style={{ backgroundColor: doc.color || typeCfg.color }}
                      />
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-2xs dark:bg-zinc-900">
                          {renderDocIcon(doc.type, 22)}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {doc.description || doc.title}
                        </p>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/30 opacity-0 backdrop-blur-2xs transition group-hover:opacity-100">
                        <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1 text-xs font-bold text-zinc-900 shadow">
                          <Eye size={12} className="text-violet-600" />
                          Buka Dokumen
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-zinc-100 px-3.5 py-2.5 text-xs text-zinc-400 dark:border-zinc-800/80">
                      <span className="truncate text-[11px]">
                        Diunggah oleh: <strong>{doc.userName || "Anggota"}</strong>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(doc.url, doc.title)}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                          title="Salin Tautan"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenInNewTab(doc.url)}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
                          title="Buka di Tab Baru"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <FolderGit2 size={24} />
              </div>
              <h3 className="mt-3.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Belum Ada Dokumen di Project Ini
              </h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">
                Sertakan dokumen Google Docs, Spreadsheet, atau Slides yang hanya dapat diakses oleh
                anggota project {project.name}.
              </p>
              <Button
                variant="primary"
                onClick={() => setIsAddDocModalOpen(true)}
                className="mt-4 text-xs"
              >
                <Plus size={14} /> Sertakan Dokumen Pertama
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL TAMBAH DOKUMEN KE PROJECT INI
         ======================================================== */}
      {isAddDocModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-xs"
          onClick={() => setIsAddDocModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <FolderGit2 size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    Sertakan Dokumen ke {project.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Hanya anggota project ini yang dapat mengakses dokumen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddDocModalOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveAddDoc} className="space-y-4 p-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tautan Google Docs / Spreadsheet / Slides <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/document/d/.../edit"
                  value={newDocUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewDocUrl(val);
                    if (val.trim()) {
                      const res = parseGoogleDocumentUrl(val);
                      setNewDocAnalysis(res);
                      if (res.isValid && !newDocTitle) {
                        setNewDocTitle(res.suggestedTitle);
                      }
                    } else {
                      setNewDocAnalysis(null);
                    }
                  }}
                  className={cn(inputClass, "mt-1.5 text-xs font-mono")}
                  autoFocus
                />
                {newDocAnalysis && newDocAnalysis.isValid && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>Terdeteksi: {getDocTypeConfig(newDocAnalysis.type).label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Judul Dokumen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Technical Specification"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Kategori
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Spesifikasi, Desain, Riset..."
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Tujuan atau catatan dokumen untuk tim..."
                  value={newDocDescription}
                  onChange={(e) => setNewDocDescription(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs resize-none")}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddDocModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" className="text-xs">
                  Sertakan Dokumen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          GOOGLE DOCS EMBED MODAL (Bisa Dibuka Langsung di Project)
         ======================================================== */}
      {activeEmbedDoc && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-0 sm:p-4 backdrop-blur-xs transition-all duration-200",
            isFullscreen && "p-0!",
          )}
        >
          <div
            className={cn(
              "flex flex-col overflow-hidden bg-white shadow-2xl transition-all duration-200 dark:bg-zinc-950",
              isFullscreen
                ? "h-screen w-screen rounded-none!"
                : "h-full w-full rounded-none border-0 sm:h-[92vh] sm:max-w-6xl sm:rounded-2xl sm:border sm:border-zinc-200 dark:sm:border-zinc-800",
            )}
          >
            {/* Topbar: Responsif Mobile & Desktop */}
            <div className="flex shrink-0 flex-col border-b border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950 sm:h-15 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-0">
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                    {renderDocIcon(activeEmbedDoc.type, 18)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-zinc-900 text-sm sm:text-base dark:text-zinc-100">
                      {activeEmbedDoc.title}
                    </h3>
                    <div className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs text-zinc-400">
                      <span className="capitalize font-medium">
                        {getDocTypeConfig(activeEmbedDoc.type).label}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400 truncate">
                        <FolderGit2 size={11} className="shrink-0" />
                        {project.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile window actions */}
                <div className="flex items-center gap-0.5 shrink-0 sm:hidden">
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                    title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDoc}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                    title="Tutup"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-850/80 sm:mt-0 sm:border-t-0 sm:pt-0 sm:justify-end sm:gap-2">
                <div className="flex shrink-0 rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setEmbedMode("edit")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs font-semibold transition",
                      embedMode === "edit"
                        ? "bg-white text-violet-700 shadow-2xs dark:bg-zinc-800 dark:text-violet-300"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    <Pencil size={11} className="sm:size-3" />
                    <span>Mode Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbedMode("preview")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs font-semibold transition",
                      embedMode === "preview"
                        ? "bg-white text-violet-700 shadow-2xs dark:bg-zinc-800 dark:text-violet-300"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    <Eye size={11} className="sm:size-3" />
                    <span>Pratinjau</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setDocDarkModeOverride(!isDocDarkMode)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold shadow-2xs transition",
                      isDocDarkMode
                        ? "border-violet-700 bg-violet-950/50 text-violet-300 hover:bg-violet-900/60"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
                    )}
                  >
                    {isDocDarkMode ? (
                      <Moon size={12} className="text-violet-400" />
                    ) : (
                      <Sun size={12} className="text-amber-500" />
                    )}
                    <span className="hidden xs:inline">
                      {isDocDarkMode ? "Docs Gelap" : "Docs Terang"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(activeEmbedDoc.url, activeEmbedDoc.title)}
                    className="rounded-lg p-1.5 sm:p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                    title="Salin Tautan Akses"
                  >
                    <Copy size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenInNewTab(activeEmbedDoc.url)}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-850"
                  >
                    <ExternalLink size={12} className="text-blue-500" />
                    <span className="hidden sm:inline">Buka di Tab Baru</span>
                    <span className="sm:hidden">Tab Baru</span>
                  </button>

                  <div className="hidden sm:flex sm:items-center sm:gap-1">
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                      title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                    >
                      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseDoc}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                      title="Tutup"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Iframe View */}
            <div
              className={cn(
                "flex-1 overflow-hidden relative transition-colors duration-300",
                isDocDarkMode ? "bg-zinc-950" : "bg-zinc-100",
              )}
            >
              <iframe
                src={getGoogleEmbedUrl(activeEmbedDoc.fileId, activeEmbedDoc.type, embedMode)}
                title={activeEmbedDoc.title}
                style={{
                  filter: isDocDarkMode ? "invert(0.92) hue-rotate(180deg) contrast(0.92)" : "none",
                  transition: "filter 0.3s ease",
                }}
                className={cn(
                  "h-full w-full border-0 transition-colors duration-300",
                  isDocDarkMode ? "bg-zinc-950" : "bg-white",
                )}
                allow="autoplay; camera; microphone; clipboard-read; clipboard-write; fullscreen; encrypted-media; picture-in-picture"
              />
            </div>

            {/* Bottom Statusbar */}
            <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-3 py-1.5 text-[11px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 sm:h-9 sm:px-5 sm:py-0 sm:text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 size={12} />
                  Dokumen Project: {project.name}
                </span>
                <span>•</span>
                <span className="truncate">
                  Tema: <strong>{isDocDarkMode ? "Gelap (Otomatis)" : "Terang"}</strong>
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                <span className="text-zinc-400">Akses Terbatas: Anggota {project.name} Saja</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTask && <TaskModal task={selectedTask} onClose={closeModal} />}
      {isCreateOpen && (
        <CreateTaskModal
          projectId={project.id}
          defaultStatus={createStatus}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
      {isMembersModalOpen && (
        <ProjectMembersModal projectId={project.id} onClose={() => setIsMembersModalOpen(false)} />
      )}
    </div>
  );
}
