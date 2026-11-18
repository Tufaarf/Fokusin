import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Filter,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  X,
  Check,
  FileDown,
  Pencil,
  Eye,
  CheckSquare,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import { WysiwygEditor } from "../components/WysiwygEditor";
import { TaskModal } from "../components/TaskModal";
import { useAppStore } from "../store";
import type { Note, Task } from "../types";
import { cn } from "../components/ui";
import { filterUserTasks } from "../utils/taskFilter";
import { formatNoteContentForView, getMentionedTasks, stripHtml } from "../utils/noteUtils";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";

export const NOTE_COLORS = [
  {
    id: "default",
    name: "Standar",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    border: "border-zinc-300 dark:border-zinc-700",
    ring: "ring-zinc-400",
    accent: "bg-zinc-400 dark:bg-zinc-600",
  },
  {
    id: "amber",
    name: "Amber",
    bg: "bg-amber-100 dark:bg-amber-950/60",
    border: "border-amber-300 dark:border-amber-800",
    ring: "ring-amber-500",
    accent: "bg-amber-500",
  },
  {
    id: "violet",
    name: "Violet",
    bg: "bg-violet-100 dark:bg-violet-950/60",
    border: "border-violet-300 dark:border-violet-800",
    ring: "ring-violet-500",
    accent: "bg-violet-500",
  },
  {
    id: "blue",
    name: "Blue",
    bg: "bg-blue-100 dark:bg-blue-950/60",
    border: "border-blue-300 dark:border-blue-800",
    ring: "ring-blue-500",
    accent: "bg-blue-500",
  },
  {
    id: "emerald",
    name: "Emerald",
    bg: "bg-emerald-100 dark:bg-emerald-950/60",
    border: "border-emerald-300 dark:border-emerald-800",
    ring: "ring-emerald-500",
    accent: "bg-emerald-500",
  },
  {
    id: "rose",
    name: "Rose",
    bg: "bg-rose-100 dark:bg-rose-950/60",
    border: "border-rose-300 dark:border-rose-800",
    ring: "ring-rose-500",
    accent: "bg-rose-500",
  },
];

function formatDate(isoDate?: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

export function NotesPage() {
  const {
    currentUser,
    notes,
    projects,
    tasks,
    notesLoading,
    syncNotes,
    syncWithBackend,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // View Mode state (stores note ID for reactivity)
  const [viewingNoteId, setViewingNoteId] = useState<string | number | null>(null);
  const viewingNote = useMemo(() => {
    if (!viewingNoteId) return null;
    return notes.find((n) => String(n.id) === String(viewingNoteId)) || null;
  }, [notes, viewingNoteId]);

  // Edit / Create Note modal state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);

  // Selected Task to view in TaskModal
  const [selectedTaskModal, setSelectedTaskModal] = useState<Task | null>(null);

  // Form states for currently edited or created note
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("default");
  const [isPinned, setIsPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initial load: sync notes and all workspace data
  useEffect(() => {
    syncNotes();
    syncWithBackend();
  }, [syncNotes, syncWithBackend]);

  // User tasks ("task yang kita miliki")
  const myTasks = useMemo(() => {
    const filtered = filterUserTasks(tasks, projects, currentUser);
    return filtered.length > 0 ? filtered : tasks;
  }, [tasks, projects, currentUser]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      n.tags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet);
  }, [notes]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        n.title.toLowerCase().includes(q) ||
        stripHtml(n.content).toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q));

      const matchTag = !selectedTag || n.tags?.includes(selectedTag);

      return matchQuery && matchTag;
    });
  }, [notes, searchQuery, selectedTag]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const regularNotes = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);

  // Open View Mode for a note
  const handleOpenViewNote = (note: Note) => {
    setIsNewNoteOpen(false);
    setEditingNote(null);
    setViewingNoteId(note.id);
  };

  // Open editor for a new note
  const handleOpenNewNote = () => {
    setViewingNoteId(null);
    setEditingNote(null);
    setTitle("");
    setContent("");
    setColor("default");
    setIsPinned(false);
    setTags([]);
    setTagInput("");
    setIsNewNoteOpen(true);
  };

  // Open editor for an existing note
  const handleOpenEditNote = (note: Note) => {
    setViewingNoteId(null);
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content || "");
    setColor(note.color || "default");
    setIsPinned(!!note.isPinned);
    setTags(note.tags || []);
    setTagInput("");
    setIsNewNoteOpen(true);
  };

  // Switch from View Mode to Edit Mode
  const handleSwitchFromViewToEdit = () => {
    if (viewingNote) {
      handleOpenEditNote(viewingNote);
    }
  };

  // Close editor modal
  const handleCloseEditModal = () => {
    setIsNewNoteOpen(false);
    setSaveSuccess(false);
    // If was editing an existing note, return to view mode for that note
    if (editingNote) {
      setViewingNoteId(editingNote.id);
      setEditingNote(null);
    }
  };

  // Add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Save note
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Judul catatan wajib diisi.", "Validasi Catatan");
      return;
    }

    setIsSaving(true);
    try {
      if (editingNote) {
        await updateNote(editingNote.id, {
          title: title.trim(),
          content,
          color,
          isPinned,
          tags,
        });
        toast.success("Catatan berhasil diperbarui.");
        setSaveSuccess(true);
        setTimeout(() => {
          setIsNewNoteOpen(false);
          setViewingNoteId(editingNote.id); // Re-open view mode with updated data
          setEditingNote(null);
          setSaveSuccess(false);
        }, 400);
      } else {
        const created = await addNote({
          title: title.trim(),
          content,
          color,
          isPinned,
          tags,
        });
        toast.success("Catatan baru berhasil disimpan.");
        setSaveSuccess(true);
        setTimeout(() => {
          setIsNewNoteOpen(false);
          if (created && created.id) {
            setViewingNoteId(created.id); // Open view mode for newly created note
          }
          setEditingNote(null);
          setSaveSuccess(false);
        }, 400);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan catatan. Silakan periksa koneksi Anda.", "Gagal Menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete note
  const handleDelete = async (id: string | number) => {
    const confirmed = await confirmDialog({
      title: "Hapus Catatan",
      message: "Apakah Anda yakin ingin menghapus catatan ini? Tindakan ini tidak dapat dibatalkan.",
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      variant: "danger",
    });

    if (confirmed) {
      try {
        await deleteNote(id);
        toast.success("Catatan berhasil dihapus.");
        if (viewingNoteId === id) {
          setViewingNoteId(null);
        }
        if (editingNote && editingNote.id === id) {
          setIsNewNoteOpen(false);
          setEditingNote(null);
        }
      } catch (err) {
        console.error(err);
        toast.error("Gagal menghapus catatan.");
      }
    }
  };

  // Export note to markdown/txt
  const handleExportText = (note: Note) => {
    const textContent = `${note.title}\n\n${stripHtml(note.content)}`;
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Catatan "${note.title}" berhasil diunduh sebagai berkas teks.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
              Catatan & Dokumen
            </h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              WYSIWYG & Mentions
            </span>
            {(currentUser?.role === "superadmin" || currentUser?.is_superadmin) && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                🛡️ Superadmin: Akses Semua Catatan Pengguna
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Tulis catatan berformat, tautkan link web, dan sebutkan (@mention) task tim Anda secara
            interaktif.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewNote}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] sm:text-sm"
          >
            <Plus size={16} />
            <span>Catatan Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari catatan, isi teks, atau tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tags horizontal scroll */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="flex items-center gap-1 text-zinc-400 shrink-0">
              <Filter size={13} />
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition",
                selectedTag === null
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
              )}
            >
              Semua
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  selectedTag === tag
                    ? "bg-violet-600 text-white dark:bg-violet-500"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {notesLoading && (
        <div className="py-12 text-center text-xs text-zinc-400 sm:text-sm">
          Menyinkronkan catatan...
        </div>
      )}

      {/* Empty State */}
      {!notesLoading && filteredNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
            <StickyNote size={24} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {searchQuery || selectedTag ? "Tidak ada catatan yang cocok" : "Belum ada catatan"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            {searchQuery || selectedTag
              ? "Coba gunakan kata kunci pencarian yang lain atau reset filter tag."
              : "Buat catatan pertama Anda sekarang untuk mencatat ide, dokumentasi, link web, atau mention task tim."}
          </p>
          <button
            onClick={handleOpenNewNote}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus size={16} />
            <span>Tulis Catatan Sekarang</span>
          </button>
        </div>
      )}

      {/* Pinned Notes Section */}
      {!notesLoading && pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            <Pin size={13} className="text-violet-500" />
            <span>Disematkan ({pinnedNotes.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                tasks={myTasks}
                onView={() => handleOpenViewNote(note)}
                onEdit={() => handleOpenEditNote(note)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => togglePinNote(note.id)}
                onExport={() => handleExportText(note)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Notes Section */}
      {!notesLoading && regularNotes.length > 0 && (
        <div className="space-y-3">
          {pinnedNotes.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              <Sparkles size={13} />
              <span>Semua Catatan ({regularNotes.length})</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regularNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                tasks={myTasks}
                onView={() => handleOpenViewNote(note)}
                onEdit={() => handleOpenEditNote(note)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => togglePinNote(note.id)}
                onExport={() => handleExportText(note)}
              />
            ))}
          </div>
        </div>
      )}

      {/* VIEW NOTE MODAL (MODE VIEW FIRST) */}
      {viewingNote && (
        <ViewNoteModal
          note={viewingNote}
          tasks={myTasks}
          projects={projects}
          onClose={() => setViewingNoteId(null)}
          onEdit={handleSwitchFromViewToEdit}
          onDelete={() => handleDelete(viewingNote.id)}
          onTogglePin={() => togglePinNote(viewingNote.id)}
          onExport={() => handleExportText(viewingNote)}
          onSelectTask={(task) => setSelectedTaskModal(task)}
        />
      )}

      {/* EDIT / CREATE NOTE MODAL */}
      {isNewNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[96vh] sm:max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
                  <StickyNote size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base">
                    {editingNote ? "Edit Catatan" : "Catatan Baru"}
                  </h2>
                  <p className="truncate text-[11px] text-zinc-500">
                    {editingNote
                      ? `Terakhir diubah: ${formatDate(editingNote.updatedAt)}`
                      : "Gunakan toolbar WYSIWYG, link web & mention task"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  title={isPinned ? "Lepas sematan" : "Sematkan ke atas"}
                  className={cn(
                    "rounded-lg p-1.5 sm:p-2 transition",
                    isPinned
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900",
                  )}
                >
                  {isPinned ? <Pin size={17} /> : <PinOff size={17} />}
                </button>

                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="rounded-lg p-1.5 sm:p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-3.5 sm:space-y-4 overflow-y-auto p-4 sm:p-6">
              {/* Title input */}
              <div>
                <input
                  type="text"
                  placeholder="Judul Catatan..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border-none bg-transparent text-lg font-bold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-700 sm:text-2xl"
                  autoFocus
                />
              </div>

              {/* Color picker & Tag controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 sm:p-3 dark:border-zinc-800/80 dark:bg-zinc-900/40">
                {/* Color Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-zinc-500 shrink-0">Warna Aksen:</span>
                  <div className="flex items-center gap-1.5">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        title={c.name}
                        className={cn(
                          "h-5 w-5 rounded-full border transition-all",
                          c.bg,
                          c.border,
                          color === c.id
                            ? `ring-2 ${c.ring} scale-110 shadow-sm`
                            : "opacity-70 hover:opacity-100",
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Tag manager */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag size={13} className="text-zinc-400 shrink-0" />
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-100"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}

                  <div className="flex items-center">
                    <input
                      type="text"
                      placeholder="+ Tag (Enter)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="h-6 w-24 rounded border border-zinc-200 bg-white px-2 text-[11px] placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* WYSIWYG Editor with Link & Task Mention support */}
              <div className="min-h-[240px] sm:min-h-[320px]">
                <WysiwygEditor
                  content={content}
                  onChange={setContent}
                  tasks={myTasks}
                  projects={projects}
                  placeholder="Mulai ketikkan isi catatan Anda... Gunakan toolbar untuk format teks, link web, atau mention task tim."
                  minHeight="min-h-[220px] sm:min-h-[300px]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-zinc-800">
              <div>
                {editingNote && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingNote.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500 transition hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                    <span className="hidden xs:inline">Hapus Catatan</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="rounded-lg border border-zinc-200 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 sm:px-5 sm:py-2 text-xs font-semibold text-white transition active:scale-[0.98]",
                    saveSuccess
                      ? "bg-emerald-600"
                      : "bg-violet-600 hover:bg-violet-700 disabled:opacity-50",
                  )}
                >
                  {saveSuccess ? (
                    <>
                      <Check size={16} />
                      <span>Tersimpan!</span>
                    </>
                  ) : isSaving ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <span>{editingNote ? "Simpan Perubahan" : "Simpan Catatan"}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL TASK MODAL (When clicked from Note View or Mentions) */}
      {selectedTaskModal && (
        <div className="relative z-[70]">
          <TaskModal task={selectedTaskModal} onClose={() => setSelectedTaskModal(null)} />
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* VIEW NOTE MODAL COMPONENT (MODE VIEW FIRST)                                */
/* ========================================================================= */

interface ViewNoteModalProps {
  note: Note;
  tasks: Task[];
  projects: any[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onExport: () => void;
  onSelectTask: (task: Task) => void;
}

function ViewNoteModal({
  note,
  tasks,
  projects,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onExport,
  onSelectTask,
}: ViewNoteModalProps) {
  const colorMeta = NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];

  // Format content: ensures external links open in new tab and task mentions become interactive chips
  const formattedHtml = useMemo(() => {
    return formatNoteContentForView(note.content, tasks);
  }, [note.content, tasks]);

  // Extract list of mentioned tasks
  const mentionedTasks = useMemo(() => {
    return getMentionedTasks(note.content, tasks);
  }, [note.content, tasks]);

  // Handle click delegation inside formatted note content
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    const taskId = target.getAttribute("data-task-id");
    const href = target.getAttribute("href") || "";

    // Task Mention Click
    if (taskId || href.startsWith("#task-")) {
      e.preventDefault();
      e.stopPropagation();
      const id = taskId || href.replace(/^#task-/, "");
      const matched = tasks.find(
        (t) =>
          String(t.id).toLowerCase() === String(id).toLowerCase() ||
          String(t.id)
            .toLowerCase()
            .replace(/^task-/, "") ===
            String(id)
              .toLowerCase()
              .replace(/^task-/, ""),
      );
      if (matched) {
        onSelectTask(matched);
      } else {
        toast.warning(`Task "${id}" tidak ditemukan atau telah dihapus.`, "Task Tidak Ditemukan");
      }
      return;
    }

    // External Link Click -> Guaranteed to open in a new tab!
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//") ||
      target.getAttribute("target") === "_blank"
    ) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  const plainText = stripHtml(note.content);
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const charCount = plainText.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] sm:max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {/* Accent Color top strip */}
        <div className={cn("absolute inset-x-0 top-0 h-1.5", colorMeta.accent)} />

        {/* Modal Header */}
        <div className="border-b border-zinc-200 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 dark:border-zinc-800">
          {/* Top Control Bar: Badges on left, Action Buttons on right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Mode Tinjau (View)
              </span>
              {note.isPinned && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                  <Pin size={11} className="fill-violet-600 dark:fill-violet-400" /> Disematkan
                </span>
              )}
            </div>

            {/* Action buttons on top right */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Toggle Pin */}
              <button
                type="button"
                onClick={onTogglePin}
                title={note.isPinned ? "Lepas sematan" : "Sematkan ke atas"}
                className={cn(
                  "rounded-lg p-1.5 sm:p-2 transition",
                  note.isPinned
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                    : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900",
                )}
              >
                {note.isPinned ? <Pin size={16} className="fill-current" /> : <PinOff size={16} />}
              </button>

              {/* Export */}
              <button
                type="button"
                onClick={onExport}
                title="Unduh sebagai file teks (.txt)"
                className="rounded-lg p-1.5 sm:p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                <FileDown size={16} />
              </button>

              {/* Direct Edit Button */}
              <button
                type="button"
                onClick={onEdit}
                title="Edit Catatan"
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit Catatan</span>
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={onDelete}
                title="Hapus catatan"
                className="rounded-lg p-1.5 sm:p-2 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 size={16} />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                title="Tutup"
                className="rounded-lg p-1.5 sm:p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Title and metadata - Full width! */}
          <div className="mt-2.5 sm:mt-3">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl break-words">
              {note.title}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {(note.userName || note.userEmail) && (
                <span>
                  Oleh:{" "}
                  <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                    {note.userName || note.userEmail}
                  </strong>
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px]">
                <Clock size={12} />
                <span>Diperbarui {formatDate(note.updatedAt || note.createdAt)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tags row */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 sm:px-6 sm:py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/30">
            <Tag size={13} className="text-zinc-400 shrink-0" />
            {note.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-8">
          {/* Main Note Content */}
          <div
            className="note-view-content text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 break-words"
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{
              __html:
                formattedHtml ||
                '<p class="italic text-zinc-400">Catatan ini belum memiliki isi teks.</p>',
            }}
          />

          {/* Referenced Tasks Section ("Task Terkait") */}
          {mentionedTasks.length > 0 && (
            <div className="mt-6 sm:mt-8 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  <CheckSquare size={14} className="text-violet-600 dark:text-violet-400" />
                  <span>Task Terkait Disebutkan ({mentionedTasks.length})</span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Klik task untuk melihat detail lengkap
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {mentionedTasks.map((t) => {
                  const proj = projects.find((p) => p.id === t.projectId);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="group flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-3 shadow-xs transition hover:border-violet-300 hover:shadow-md cursor-pointer dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-700"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-violet-600 dark:text-violet-400 group-hover:underline">
                            @{t.id}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                              t.status === "done" &&
                                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                              t.status === "progress" &&
                                "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                              t.status === "review" &&
                                "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
                              t.status === "todo" &&
                                "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                            )}
                          >
                            {t.status}
                          </span>
                        </div>
                        <h4 className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 line-clamp-1">
                          {t.title}
                        </h4>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-100 pt-2 dark:border-zinc-900">
                        <span>{proj ? proj.name : t.assignee || "Task"}</span>
                        <span className="flex items-center gap-0.5 font-medium text-violet-600 dark:text-violet-400 group-hover:translate-x-0.5 transition-transform">
                          Buka detail <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-200 px-4 py-3 sm:px-6 sm:py-3.5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <span>{wordCount} kata</span>
            <span>·</span>
            <span>{charCount} karakter</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden md:inline-flex items-center gap-1 text-[11px]">
              <Info size={12} /> Klik link web untuk membuka di tab baru, klik mention task untuk
              melihat detail
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none text-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
            >
              <Pencil size={14} />
              <span>Edit Catatan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* NOTE CARD COMPONENT                                                       */
/* ========================================================================= */

interface NoteCardProps {
  note: Note;
  tasks: Task[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onExport: () => void;
}

function NoteCard({ note, tasks, onView, onEdit, onDelete, onTogglePin, onExport }: NoteCardProps) {
  const colorMeta = NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];
  const plainText = stripHtml(note.content);

  // Check if note mentions any tasks
  const mentionedTasks = useMemo(() => {
    return getMentionedTasks(note.content, tasks);
  }, [note.content, tasks]);

  return (
    <div
      onClick={onView}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer dark:bg-zinc-950",
        note.isPinned
          ? "border-violet-300 dark:border-violet-900/60 ring-1 ring-violet-500/20"
          : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700",
      )}
    >
      {/* Accent Color top strip */}
      <div className={cn("absolute inset-x-0 top-0 h-1 rounded-t-xl", colorMeta.accent)} />

      <div>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400">
              {note.title}
            </h3>
            {(note.userName || note.userEmail) && (
              <p className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                Oleh:{" "}
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {note.userName || note.userEmail}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={note.isPinned ? "Lepas sematan" : "Sematkan"}
              className={cn(
                "rounded-md p-1 transition",
                note.isPinned
                  ? "text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200",
              )}
            >
              <Pin
                size={14}
                className={note.isPinned ? "fill-violet-600 dark:fill-violet-400" : ""}
              />
            </button>
          </div>
        </div>

        {/* Content Excerpt */}
        <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {plainText || <span className="italic text-zinc-400">Catatan kosong</span>}
        </p>
      </div>

      {/* Footer area */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900">
        {/* Badges row: Tags & Task Mention Count */}
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {/* Mentioned task count badge */}
          {mentionedTasks.length > 0 && (
            <span
              title={`${mentionedTasks.length} task disebutkan`}
              className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300"
            >
              <CheckSquare size={10} />
              <span>{mentionedTasks.length} task</span>
            </span>
          )}

          {/* Tags */}
          {note.tags &&
            note.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
              >
                #{t}
              </span>
            ))}
          {note.tags && note.tags.length > 3 && (
            <span className="text-[10px] text-zinc-400">+{note.tags.length - 3}</span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1 truncate min-w-0 mr-1.5">
            <Clock size={11} className="shrink-0" />
            <span className="truncate">{formatDate(note.updatedAt || note.createdAt)}</span>
          </span>

          {/* Action Buttons: Visible on mobile, hover on desktop */}
          <div className="flex items-center gap-0.5 sm:gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              title="Lihat catatan"
              className="rounded p-1 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit catatan"
              className="rounded p-1 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
              title="Unduh sebagai file teks"
              className="rounded p-1 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            >
              <FileDown size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Hapus catatan"
              className="rounded p-1 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
