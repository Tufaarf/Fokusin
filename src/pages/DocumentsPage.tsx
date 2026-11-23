import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  FolderOpen,
  HardDrive,
  Info,
  LayoutGrid,
  List,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  MoreVertical,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Button, Badge, cn, inputClass } from "../components/ui";
import { useAppStore } from "../store";
import type { GoogleDocument, GoogleDocumentType } from "../types";
import { getDocTypeConfig, getGoogleEmbedUrl, parseGoogleDocumentUrl } from "../utils/googleDocs";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";

const CATEGORY_SUGGESTIONS = [
  "Umum",
  "Dokumentasi",
  "Keuangan",
  "Meeting",
  "Manajemen",
  "Pemasaran",
  "Desain",
  "Riset",
];

const COLOR_OPTIONS = [
  { name: "Biru Docs", hex: "#4285F4", class: "bg-blue-600" },
  { name: "Hijau Sheets", hex: "#0F9D58", class: "bg-emerald-600" },
  { name: "Kuning Slides", hex: "#F4B400", class: "bg-amber-500" },
  { name: "Ungu", hex: "#7c3aed", class: "bg-violet-600" },
  { name: "Merah Muda", hex: "#e11d48", class: "bg-rose-600" },
  { name: "Abu-Abu", hex: "#71717a", class: "bg-zinc-500" },
];

function formatTimeAgo(isoDate?: string): string {
  if (!isoDate) return "Baru saja";
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "Baru saja";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} hari lalu`;

    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function DocumentsPage() {
  const {
    documents,
    documentsLoading,
    syncDocuments,
    addDocument,
    updateDocument,
    deleteDocument,
    toggleStarDocument,
    recordOpenDocument,
    currentUser,
    theme,
    projects,
  } = useAppStore();

  // ========================================================
  // FILTER, SEARCH & LAYOUT STATES
  // ========================================================
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | GoogleDocumentType>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [sortBy, setSortBy] = useState<"updated" | "opened" | "title-asc" | "title-desc" | "type">(
    "updated",
  );

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("fokusin_drive_layout");
      if (saved === "list" || saved === "grid") return saved;
    }
    return "grid";
  });

  const handleSetViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("fokusin_drive_layout", mode);
    }
  };

  // ========================================================
  // EMBED VIEWER & MODALS STATES
  // ========================================================
  const [activeEmbedDoc, setActiveEmbedDoc] = useState<GoogleDocument | null>(null);
  const [embedMode, setEmbedMode] = useState<"edit" | "preview">("edit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [docDarkModeOverride, setDocDarkModeOverride] = useState<boolean | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Otomatis sinkron dengan tema aplikasi (theme === 'dark')
  const isDocDarkMode = docDarkModeOverride !== null ? docDarkModeOverride : theme === "dark";

  // Add / Edit Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GoogleDocument | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [formCategory, setFormCategory] = useState("Umum");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#4285F4");
  const [formStarred, setFormStarred] = useState(false);
  const [urlAnalysis, setUrlAnalysis] = useState<ReturnType<typeof parseGoogleDocumentUrl> | null>(
    null,
  );

  // Project Yang Bisa Diakses Oleh Pengguna Saat Ini
  const userProjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.is_superadmin || currentUser.role === "superadmin") return projects;
    return projects.filter((p) => {
      if (p.created_by && String(p.created_by) === String(currentUser.id)) return true;
      if (
        p.members?.some(
          (m) =>
            String(m).toLowerCase() === String(currentUser.name).toLowerCase() ||
            String(m).toLowerCase() === String(currentUser.email).toLowerCase() ||
            String(m) === String(currentUser.id),
        )
      ) {
        return true;
      }
      if (
        p.member_details?.some(
          (m) =>
            String(m.id) === String(currentUser.id) ||
            (m.email && m.email.toLowerCase() === currentUser.email?.toLowerCase()),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [projects, currentUser]);

  const userProjectIds = useMemo(() => {
    return new Set(userProjects.map((p) => p.id));
  }, [userProjects]);

  // Initial Sync from Backend
  useEffect(() => {
    syncDocuments().catch(() => {});
  }, [syncDocuments]);

  // Live URL parsing when typing in Add modal
  useEffect(() => {
    if (!formUrl.trim()) {
      setUrlAnalysis(null);
      return;
    }
    const res = parseGoogleDocumentUrl(formUrl);
    setUrlAnalysis(res);
    if (res.isValid) {
      if (
        !formTitle ||
        formTitle === "Dokumen Tanpa Judul" ||
        formTitle === "Spreadsheet Tanpa Judul"
      ) {
        setFormTitle(res.suggestedTitle);
      }
      if (res.type === "sheets") setFormColor("#0F9D58");
      else if (res.type === "slides") setFormColor("#F4B400");
      else setFormColor("#4285F4");
    }
  }, [formUrl]);

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    if (menuOpenId) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenId]);

  // ========================================================
  // PRIVACY: HAK AKSES DOKUMEN (PRIBADI & ANGGOTA PROJECT)
  // ========================================================
  const myDocuments = useMemo(() => {
    if (!currentUser) {
      return documents.filter((doc) => !doc.userId || doc.userName === "You");
    }

    return documents.filter((doc) => {
      // 1. Dokumen yang disertakan ke dalam project: hanya anggota project tersebut yang dapat mengakses
      if (doc.projectId) {
        if (currentUser.is_superadmin || currentUser.role === "superadmin") return true;
        return userProjectIds.has(doc.projectId);
      }

      // 2. Dokumen pribadi (tanpa project): hanya dapat dilihat oleh pengunggahnya sendiri
      if (
        doc.userId !== undefined &&
        doc.userId !== null &&
        currentUser.id !== undefined &&
        currentUser.id !== null
      ) {
        if (String(doc.userId) === String(currentUser.id)) return true;
      }

      if (
        doc.userEmail &&
        currentUser.email &&
        doc.userEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
      ) {
        return true;
      }

      if (
        doc.userName &&
        currentUser.name &&
        doc.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      ) {
        return true;
      }

      return false;
    });
  }, [documents, currentUser, userProjectIds]);

  // Daftar Kategori Unik Milik Pengguna
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    myDocuments.forEach((d) => {
      if (d.category && d.category.trim()) cats.add(d.category.trim());
    });
    return Array.from(cats);
  }, [myDocuments]);

  // Dokumen Terfilter dan Terurut
  const filteredDocuments = useMemo(() => {
    return myDocuments
      .filter((doc) => {
        if (selectedType !== "all" && doc.type !== selectedType) return false;
        if (selectedCategory !== "all" && doc.category !== selectedCategory) return false;
        if (onlyStarred && !doc.isStarred) return false;

        // Filter Scope Project
        if (selectedProject !== "all") {
          if (selectedProject === "personal") {
            if (doc.projectId) return false;
          } else {
            if (doc.projectId !== selectedProject) return false;
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = doc.title.toLowerCase().includes(q);
          const matchCategory = doc.category.toLowerCase().includes(q);
          const matchDesc = doc.description?.toLowerCase().includes(q) ?? false;
          const matchProject = doc.projectName?.toLowerCase().includes(q) ?? false;
          if (!matchTitle && !matchCategory && !matchDesc && !matchProject) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "opened") {
          const dateA = new Date(a.lastOpenedAt || 0).getTime();
          const dateB = new Date(b.lastOpenedAt || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === "title-asc") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "title-desc") {
          return b.title.localeCompare(a.title);
        }
        if (sortBy === "type") {
          return a.type.localeCompare(b.type);
        }
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
  }, [myDocuments, selectedType, selectedCategory, onlyStarred, searchQuery, sortBy]);

  const recentDocuments = useMemo(() => {
    return [...myDocuments]
      .sort(
        (a, b) =>
          new Date(b.lastOpenedAt || b.updatedAt).getTime() -
          new Date(a.lastOpenedAt || a.updatedAt).getTime(),
      )
      .slice(0, 4);
  }, [myDocuments]);

  const stats = useMemo(() => {
    const total = myDocuments.length;
    const docs = myDocuments.filter((d) => d.type === "docs").length;
    const sheets = myDocuments.filter((d) => d.type === "sheets").length;
    const slides = myDocuments.filter((d) => d.type === "slides").length;
    const starred = myDocuments.filter((d) => d.isStarred).length;
    return { total, docs, sheets, slides, starred };
  }, [myDocuments]);

  // ========================================================
  // EMBED VIEWER HANDLERS
  // ========================================================
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

  // Form CRUD Handlers
  const handleOpenAddModal = (presetProjectId?: string | React.MouseEvent) => {
    setFormUrl("");
    setFormTitle("");
    setFormProjectId(typeof presetProjectId === "string" ? presetProjectId : "");
    setFormCategory("Umum");
    setFormDescription("");
    setFormColor("#4285F4");
    setFormStarred(false);
    setUrlAnalysis(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (doc: GoogleDocument) => {
    setEditingDoc(doc);
    setFormUrl(doc.url);
    setFormTitle(doc.title);
    setFormProjectId(doc.projectId || "");
    setFormCategory(doc.category || "Umum");
    setFormDescription(doc.description || "");
    setFormColor(doc.color || "#4285F4");
    setFormStarred(Boolean(doc.isStarred));
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim()) {
      toast.warning("Harap masukkan link Google Docs, Sheets, atau Slides.");
      return;
    }

    const parsed = parseGoogleDocumentUrl(formUrl);
    if (!parsed.isValid) {
      toast.error(
        parsed.error ||
          "Link tidak valid. Pastikan link berasal dari Google Docs, Spreadsheet, atau Slides.",
      );
      return;
    }

    const finalTitle = formTitle.trim() || parsed.suggestedTitle;
    const selectedProjectObj = userProjects.find((p) => p.id === formProjectId);

    try {
      const created = await addDocument({
        url: formUrl.trim(),
        title: finalTitle,
        projectId: formProjectId || null,
        projectName: selectedProjectObj ? selectedProjectObj.name : null,
        category: formCategory.trim() || "Umum",
        description: formDescription.trim(),
        color: formColor,
        isStarred: formStarred,
      });

      setIsAddModalOpen(false);
      toast.success(
        formProjectId && selectedProjectObj
          ? `Dokumen "${finalTitle}" berhasil disertakan ke project ${selectedProjectObj.name}.`
          : `Dokumen "${finalTitle}" berhasil ditambahkan.`,
      );
      handleOpenDoc(created);
    } catch {
      toast.error("Gagal menambahkan dokumen.");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (!formTitle.trim()) {
      toast.warning("Judul dokumen tidak boleh kosong.");
      return;
    }

    const selectedProjectObj = userProjects.find((p) => p.id === formProjectId);

    try {
      await updateDocument(editingDoc.id, {
        title: formTitle.trim(),
        projectId: formProjectId || null,
        projectName: selectedProjectObj ? selectedProjectObj.name : null,
        category: formCategory.trim() || "Umum",
        description: formDescription.trim(),
        color: formColor,
        isStarred: formStarred,
      });

      if (activeEmbedDoc?.id === editingDoc.id) {
        setActiveEmbedDoc({
          ...activeEmbedDoc,
          title: formTitle.trim(),
          projectId: formProjectId || null,
          projectName: selectedProjectObj ? selectedProjectObj.name : null,
          category: formCategory.trim() || "Umum",
          description: formDescription.trim(),
          color: formColor,
          isStarred: formStarred,
        });
      }

      setEditingDoc(null);
      toast.success("Informasi dokumen berhasil diperbarui.");
    } catch {
      toast.error("Gagal memperbarui dokumen.");
    }
  };

  const handleDelete = async (doc: GoogleDocument) => {
    const confirmed = await confirmDialog({
      title: "Hapus Dokumen",
      message: `Apakah Anda yakin ingin menghapus "${doc.title}" dari penyimpanan Fokusin? Dokumen di Google Drive Anda tidak akan terhapus.`,
      confirmText: "Hapus",
      cancelText: "Batal",
      variant: "danger",
    });

    if (confirmed) {
      await deleteDocument(doc.id);
      if (activeEmbedDoc?.id === doc.id) {
        setActiveEmbedDoc(null);
      }
      toast.info(`Dokumen "${doc.title}" telah dihapus.`);
    }
  };

  const handleCopyLink = (url: string, title: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`Tautan untuk "${title}" berhasil disalin ke clipboard.`);
  };

  const handleOpenInNewTab = (url?: string) => {
    const targetUrl = (url || activeEmbedDoc?.url || "").trim();
    if (!targetUrl) return;

    // Buka secara eksplisit di tab browser baru tanpa menggantikan tab saat ini
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

  const renderDocIcon = (type: GoogleDocumentType, size: number = 20) => {
    switch (type) {
      case "sheets":
        return (
          <FileSpreadsheet
            size={size}
            className="text-emerald-600 dark:text-emerald-400 shrink-0"
          />
        );
      case "slides":
        return <Presentation size={size} className="text-amber-500 dark:text-amber-400 shrink-0" />;
      default:
        return <FileText size={size} className="text-blue-600 dark:text-blue-400 shrink-0" />;
    }
  };

  // ========================================================
  // MAIN GOOGLE DRIVE EMBED STORAGE SCREEN
  // ========================================================
  return (
    <div className="min-h-full space-y-6 pb-16">
      {/* ========================================================
          TOP GOOGLE DRIVE BANNER & ACTION BAR
         ======================================================== */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
              <HardDrive size={13} />
              Drive Saya
            </span>
            <span>/</span>
            <span className="truncate">
              {onlyStarred
                ? "Berbintang"
                : selectedType !== "all"
                  ? getDocTypeConfig(selectedType).label
                  : selectedCategory !== "all"
                    ? selectedCategory
                    : "Semua File"}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              Dokumen & Drive
            </h1>
            <Badge className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/60 dark:text-violet-300">
              Google Embed
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Lock size={11} />
              Privat ({currentUser?.name || "Hanya Anda"})
            </span>
          </div>

          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            Buka dan edit dokumen Google Docs, Spreadsheet, dan Slides langsung melalui link
            embedding.
          </p>
        </div>

        {/* Action Buttons & Add New */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add New Button */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-600/30 bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 hover:shadow active:scale-95 dark:border-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Tambah Dokumen</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          SEARCH BAR, VIEW MODE TOGGLE & QUICK FILTERS
         ======================================================== */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder="Cari nama dokumen, kategori, atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(inputClass, "pl-10 h-10 text-xs sm:text-sm")}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Controls: Grid vs List Layout & Sort By */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Layout Toggle */}
            <div className="flex items-center rounded-xl border border-zinc-200 bg-white p-1 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => handleSetViewMode("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition",
                  viewMode === "grid"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 font-bold"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                )}
                title="Tampilan Grid (Kartu)"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition",
                  viewMode === "list"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 font-bold"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                )}
                title="Tampilan List (Tabel)"
              >
                <List size={16} />
              </button>
            </div>

            {/* Filter Scope Project */}
            {userProjects.length > 0 && (
              <div className="relative">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 pr-8 text-xs font-semibold text-zinc-700 shadow-2xs outline-none transition focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <option value="all">📁 Semua Scope (Pribadi & Project)</option>
                  <option value="personal">🔒 Hanya Dokumen Pribadi</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      📁 Project: {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 pr-8 text-xs font-medium text-zinc-700 shadow-2xs outline-none transition focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <option value="updated">Terakhir Diperbarui</option>
                <option value="opened">Terakhir Dibuka</option>
                <option value="title-asc">Nama (A - Z)</option>
                <option value="title-desc">Nama (Z - A)</option>
                <option value="type">Tipe Dokumen</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            onClick={() => {
              setSelectedType("all");
              setOnlyStarred(false);
              setSelectedCategory("all");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              selectedType === "all" && !onlyStarred && selectedCategory === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            <FolderOpen size={13} />
            Semua File ({stats.total})
          </button>

          <button
            onClick={() => {
              setSelectedType(selectedType === "docs" ? "all" : "docs");
              setOnlyStarred(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              selectedType === "docs"
                ? "bg-blue-600 text-white shadow-xs"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-300",
            )}
          >
            <FileText
              size={13}
              className={selectedType === "docs" ? "text-white" : "text-blue-500"}
            />
            Google Docs ({stats.docs})
          </button>

          <button
            onClick={() => {
              setSelectedType(selectedType === "sheets" ? "all" : "sheets");
              setOnlyStarred(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              selectedType === "sheets"
                ? "bg-emerald-600 text-white shadow-xs"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300",
            )}
          >
            <FileSpreadsheet
              size={13}
              className={selectedType === "sheets" ? "text-white" : "text-emerald-500"}
            />
            Spreadsheet ({stats.sheets})
          </button>

          <button
            onClick={() => {
              setSelectedType(selectedType === "slides" ? "all" : "slides");
              setOnlyStarred(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              selectedType === "slides"
                ? "bg-amber-500 text-white shadow-xs"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-amber-50 hover:text-amber-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-amber-950/40 dark:hover:text-amber-300",
            )}
          >
            <Presentation
              size={13}
              className={selectedType === "slides" ? "text-white" : "text-amber-500"}
            />
            Slide ({stats.slides})
          </button>

          <button
            onClick={() => setOnlyStarred(!onlyStarred)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              onlyStarred
                ? "bg-amber-500 text-white shadow-xs"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-amber-50 hover:text-amber-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-amber-950/40",
            )}
          >
            <Star
              size={13}
              className={onlyStarred ? "fill-white text-white" : "fill-amber-400 text-amber-500"}
            />
            Berbintang ({stats.starred})
          </button>

          {allCategories.length > 0 && (
            <div className="relative inline-flex items-center">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 rounded-full border border-zinc-200 bg-white px-3 pr-6 text-xs font-medium text-zinc-600 shadow-2xs outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <option value="all">Kategori: Semua</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          SUGGESTED / RECENTLY OPENED FILES (SUGGESTED SECTION)
         ======================================================== */}
      {recentDocuments.length > 0 && !searchQuery && selectedType === "all" && !onlyStarred && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Disarankan / Baru Dibuka
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentDocuments.map((doc) => {
              return (
                <div
                  key={`rec-${doc.id}`}
                  onClick={() => handleOpenDoc(doc)}
                  className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-violet-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800/80">
                        {renderDocIcon(doc.type, 18)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-zinc-900 group-hover:text-violet-600 dark:text-zinc-100 dark:group-hover:text-violet-400">
                          {doc.title}
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">
                          {doc.category || "Umum"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStarDocument(doc.id);
                      }}
                      className="rounded-full p-1 text-zinc-300 transition hover:text-amber-500 dark:text-zinc-600"
                    >
                      <Star
                        size={14}
                        className={
                          doc.isStarred ? "fill-amber-400 text-amber-500" : "hover:text-amber-500"
                        }
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400 dark:border-zinc-800/80">
                    <span className="truncate">Dibuka {formatTimeAgo(doc.lastOpenedAt)}</span>
                    <span className="flex items-center gap-0.5 text-violet-600 font-medium opacity-0 transition group-hover:opacity-100 dark:text-violet-400">
                      Buka Embed <ExternalLink size={10} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================
          MAIN STORAGE FILES LIST OR GRID
         ======================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Semua Dokumen ({filteredDocuments.length})
          </h2>
        </div>

        {documentsLoading ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <RefreshCw size={24} className="animate-spin text-violet-600" />
            <p className="mt-3 text-xs text-zinc-500">Memuat berkas dokumen...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <FolderOpen size={26} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {searchQuery || selectedType !== "all" || onlyStarred || selectedCategory !== "all"
                ? "Tidak ada dokumen yang cocok dengan filter"
                : "Belum ada dokumen yang ditambahkan"}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-400">
              Tambahkan tautan Google Docs, Spreadsheet, atau Slides untuk menyimpannya dan
              membukanya langsung di Fokusin.
            </p>
            <div className="mt-5">
              <Button onClick={handleOpenAddModal} variant="primary" className="text-xs">
                <Plus size={14} />
                <span>Tambah Dokumen Baru</span>
              </Button>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* ========================================================
              GRID VIEW (KARTU ALA GOOGLE DRIVE)
             ======================================================== */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDocuments.map((doc) => {
              const typeCfg = getDocTypeConfig(doc.type);

              return (
                <div
                  key={doc.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-800"
                >
                  {/* Card Header: Type Badge, Title, and Action Dropdown */}
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
                        <span className="inline-block rounded-md text-[10px] font-medium text-zinc-400">
                          {doc.category || "Umum"}
                        </span>
                      </div>
                    </div>

                    {/* Action Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === doc.id ? null : doc.id);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {/* Dropdown Options */}
                      {menuOpenId === doc.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 animate-fade-in"
                        >
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              handleOpenDoc(doc);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            <Eye size={13} className="text-violet-600" />
                            <span>Buka & Edit Dokumen</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              handleOpenInNewTab(doc.url);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            <ExternalLink size={13} className="text-blue-500" />
                            <span>Buka di Tab Baru</span>
                          </button>

                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              handleCopyLink(doc.url, doc.title);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            <Copy size={13} />
                            <span>Salin Tautan</span>
                          </button>

                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              handleOpenEditModal(doc);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            <Pencil size={13} />
                            <span>Edit Informasi</span>
                          </button>

                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              handleDelete(doc);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={13} />
                            <span>Hapus Dokumen</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail / Document Preview Card (Clickable) */}
                  <div
                    onClick={() => handleOpenDoc(doc)}
                    className="relative mx-3.5 my-2 flex h-36 cursor-pointer flex-col justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/90 p-4 transition group-hover:border-violet-200 group-hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:group-hover:bg-zinc-950"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: doc.color || typeCfg.color }}
                    />

                    {/* Watermark Logo */}
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-2xs dark:bg-zinc-900">
                        {renderDocIcon(doc.type, 26)}
                      </div>
                      <p className="mt-2.5 line-clamp-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {doc.description || doc.title}
                      </p>
                    </div>

                    {/* Hover Overlay Button */}
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/30 opacity-0 backdrop-blur-2xs transition group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-900 shadow-md">
                        <Eye size={13} className="text-violet-600" />
                        Buka & Edit Embed
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Metadata and Star Button */}
                  <div className="flex items-center justify-between border-t border-zinc-100 px-3.5 py-2.5 text-xs text-zinc-400 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {doc.projectId ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 truncate max-w-[130px]">
                          <FolderGit2 size={10} className="shrink-0" />
                          <span className="truncate">{doc.projectName || doc.projectId}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                          <Lock size={9} className="shrink-0" />
                          Pribadi
                        </span>
                      )}
                      <span className="truncate text-[11px] text-zinc-400">
                        • {formatTimeAgo(doc.updatedAt || doc.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStarDocument(doc.id);
                        }}
                        className="rounded-lg p-1 text-zinc-300 transition hover:text-amber-500 dark:text-zinc-600"
                        title={doc.isStarred ? "Hapus Bintang" : "Beri Bintang"}
                      >
                        <Star
                          size={15}
                          className={
                            doc.isStarred ? "fill-amber-400 text-amber-500" : "hover:text-amber-500"
                          }
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================
              LIST VIEW (TABEL DAFTAR ALA GOOGLE DRIVE)
             ======================================================== */
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="py-3 pl-4 pr-2">Nama Dokumen</th>
                    <th className="px-3 py-3">Tipe</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Terakhir Diperbarui</th>
                    <th className="py-3 pl-3 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredDocuments.map((doc) => {
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => handleOpenDoc(doc)}
                        className="group cursor-pointer transition hover:bg-violet-50/40 dark:hover:bg-zinc-800/50"
                      >
                        <td className="py-3 pl-4 pr-2">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStarDocument(doc.id);
                              }}
                              className="rounded p-1 text-zinc-300 transition hover:text-amber-500 dark:text-zinc-600"
                            >
                              <Star
                                size={14}
                                className={
                                  doc.isStarred
                                    ? "fill-amber-400 text-amber-500"
                                    : "hover:text-amber-500"
                                }
                              />
                            </button>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800">
                              {renderDocIcon(doc.type, 16)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-zinc-900 group-hover:text-violet-600 dark:text-zinc-100 dark:group-hover:text-violet-400 max-w-xs sm:max-w-md">
                                {doc.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {doc.projectId ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.2 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 shrink-0">
                                    <FolderGit2 size={10} />
                                    {doc.projectName || doc.projectId}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                                    <Lock size={9} />
                                    Pribadi
                                  </span>
                                )}
                                {doc.description && (
                                  <p className="truncate text-[11px] text-zinc-400 max-w-xs">
                                    • {doc.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span className="capitalize text-zinc-600 dark:text-zinc-300">
                            {getDocTypeConfig(doc.type).label}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {doc.category || "Umum"}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-zinc-400">
                          {formatTimeAgo(doc.updatedAt || doc.createdAt)}
                        </td>

                        <td className="py-3 pl-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDoc(doc);
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-violet-600 dark:hover:bg-zinc-800 dark:hover:text-violet-400"
                              title="Buka Dokumen (Embed)"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInNewTab(doc.url);
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                              title="Buka di Tab Baru"
                            >
                              <ExternalLink size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(doc);
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                              title="Edit Info"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(doc);
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                              title="Hapus"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================
          GOOGLE DOCS EMBED MODAL (Bisa Dibuka & Diedit Langsung)
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
            {/* Topbar: Document Info & Controls (Responsif Desktop & Mobile) */}
            <div className="flex shrink-0 flex-col border-b border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950 sm:h-15 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-0">
              {/* Row 1 di Mobile / Sisi Kiri di Desktop: Judul Dokumen & Window Controls */}
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
                      <span className="truncate">Kategori: {activeEmbedDoc.category}</span>
                      {activeEmbedDoc.projectId && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400 truncate">
                            <FolderGit2 size={11} className="shrink-0" />
                            {activeEmbedDoc.projectName || activeEmbedDoc.projectId}
                          </span>
                        </>
                      )}
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">
                        Terakhir dibuka: {formatTimeAgo(activeEmbedDoc.lastOpenedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile-only Window Actions (Fullscreen & Tutup) */}
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

              {/* Row 2 di Mobile / Sisi Kanan di Desktop: Toolbar Aksi Dokumen */}
              <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-850/80 sm:mt-0 sm:border-t-0 sm:pt-0 sm:justify-end sm:gap-2">
                {/* Mode Toggle: Edit vs Pratinjau (Tersedia di Mobile & Desktop) */}
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

                {/* Tombol Aksi Tambahan */}
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Auto Theme Sync Toggle */}
                  <button
                    type="button"
                    onClick={() => setDocDarkModeOverride(!isDocDarkMode)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold shadow-2xs transition",
                      isDocDarkMode
                        ? "border-violet-700 bg-violet-950/50 text-violet-300 hover:bg-violet-900/60"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
                    )}
                    title={
                      isDocDarkMode
                        ? "Mode Gelap Otomatis Aktif (Klik untuk beralih ke Mode Terang Asli)"
                        : "Mode Terang Aktif (Klik untuk beralih ke Mode Gelap)"
                    }
                  >
                    {isDocDarkMode ? (
                      <Moon size={12} className="text-violet-400 sm:size-3.5" />
                    ) : (
                      <Sun size={12} className="text-amber-500 sm:size-3.5" />
                    )}
                    <span className="hidden xs:inline">
                      {isDocDarkMode ? "Docs Gelap" : "Docs Terang"}
                    </span>
                  </button>

                  {/* Salin Link */}
                  <button
                    type="button"
                    onClick={() => handleCopyLink(activeEmbedDoc.url, activeEmbedDoc.title)}
                    className="rounded-lg p-1.5 sm:p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                    title="Salin Tautan Akses"
                  >
                    <Copy size={15} />
                  </button>

                  {/* Buka di Google Docs Tab Baru */}
                  <button
                    type="button"
                    onClick={() => handleOpenInNewTab(activeEmbedDoc.url)}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-850"
                    title="Buka Dokumen di Tab Baru"
                  >
                    <ExternalLink size={12} className="text-blue-500 sm:size-3.5" />
                    <span className="hidden sm:inline">Buka di Tab Baru</span>
                    <span className="sm:hidden">Tab Baru</span>
                  </button>

                  {/* Desktop-only Window Controls */}
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

            {/* Iframe Embedding Body with Auto Dark/Light Adaptation */}
            <div
              className={cn(
                "flex-1 overflow-hidden relative transition-colors duration-300",
                isDocDarkMode ? "bg-zinc-950" : "bg-zinc-100",
              )}
            >
              <iframe
                key={`${activeEmbedDoc.id}-${embedMode}-${iframeKey}-${isDocDarkMode ? "dark" : "light"}`}
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

            {/* Bottom Statusbar (Responsif) */}
            <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-3 py-1.5 text-[11px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 sm:h-9 sm:px-5 sm:py-0 sm:text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 size={12} />
                  Google Embed Aktif
                </span>
                <span>•</span>
                <span className="truncate">
                  Tema:{" "}
                  <strong
                    className={
                      isDocDarkMode
                        ? "text-violet-400 font-semibold"
                        : "text-zinc-600 dark:text-zinc-300 font-semibold"
                    }
                  >
                    {isDocDarkMode ? "Mode Gelap (Otomatis)" : "Mode Terang Asli"}
                  </strong>
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                <span className="text-zinc-400">Fokusin Documents</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL TAMBAH DOKUMEN GOOGLE (Add Modal)
         ======================================================== */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-xs"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <Plus size={16} strokeWidth={2.5} />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Tambah Dokumen Google Baru
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4 p-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tautan Google Docs / Spreadsheet / Slides <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/document/d/.../edit"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs font-mono")}
                  autoFocus
                />
                {urlAnalysis && urlAnalysis.isValid && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>Terdeteksi: {getDocTypeConfig(urlAnalysis.type).label}</span>
                  </div>
                )}
                {urlAnalysis && !urlAnalysis.isValid && formUrl.length > 8 && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{urlAnalysis.error}</span>
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
                  placeholder="Contoh: SOP Operasional Tim 2026"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Sertakan ke Project (Opsional)
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                >
                  <option value="">🔒 Dokumen Pribadi (Hanya Saya yang Bisa Akses)</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      📁 {p.name} ({p.id}) — Hanya anggota project
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {formProjectId
                    ? "Dokumen ini hanya dapat dilihat dan diakses oleh anggota yang ada di dalam project ini."
                    : "Dokumen ini bersifat pribadi dan hanya dapat diakses oleh Anda sendiri."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Kategori
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="Pilih atau ketik kategori..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={cn(inputClass, "mt-1.5 text-xs")}
                  />
                  <datalist id="category-suggestions">
                    {CATEGORY_SUGGESTIONS.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Warna Penanda
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFormColor(c.hex)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-transform active:scale-90 flex items-center justify-center text-white",
                          c.class,
                          formColor === c.hex && "ring-2 ring-violet-500 ring-offset-2 scale-110",
                        )}
                        title={c.name}
                      >
                        {formColor === c.hex && <Check size={12} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan ringkas mengenai isi atau tujuan dokumen ini..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs resize-none")}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="form-starred-add"
                  checked={formStarred}
                  onChange={(e) => setFormStarred(e.target.checked)}
                  className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                />
                <label
                  htmlFor="form-starred-add"
                  className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Tandai sebagai dokumen berbintang (favorit)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" className="text-xs">
                  Simpan Dokumen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL EDIT INFORMASI DOKUMEN (Edit Modal)
         ======================================================== */}
      {editingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-xs"
          onClick={() => setEditingDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <Pencil size={15} />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Edit Informasi Dokumen
                </h3>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Judul Dokumen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Sertakan ke Project (Opsional)
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                >
                  <option value="">🔒 Dokumen Pribadi (Hanya Saya yang Bisa Akses)</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      📁 {p.name} ({p.id}) — Hanya anggota project
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {formProjectId
                    ? "Dokumen ini hanya dapat dilihat dan diakses oleh anggota yang ada di dalam project ini."
                    : "Dokumen ini bersifat pribadi dan hanya dapat diakses oleh Anda sendiri."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Kategori
                  </label>
                  <input
                    type="text"
                    list="category-suggestions-edit"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={cn(inputClass, "mt-1.5 text-xs")}
                  />
                  <datalist id="category-suggestions-edit">
                    {CATEGORY_SUGGESTIONS.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Warna Penanda
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFormColor(c.hex)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-transform active:scale-90 flex items-center justify-center text-white",
                          c.class,
                          formColor === c.hex && "ring-2 ring-violet-500 ring-offset-2 scale-110",
                        )}
                        title={c.name}
                      >
                        {formColor === c.hex && <Check size={12} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs resize-none")}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="form-starred-edit"
                  checked={formStarred}
                  onChange={(e) => setFormStarred(e.target.checked)}
                  className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                />
                <label
                  htmlFor="form-starred-edit"
                  className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Tandai sebagai dokumen berbintang
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingDoc(null)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" className="text-xs">
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
