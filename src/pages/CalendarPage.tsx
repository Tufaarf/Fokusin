import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Filter,
  Pencil,
  RotateCcw,
  Trash2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { CalendarGrid } from "../components/CalendarGrid";
import { Badge, Button, Card, cn, inputClass, Modal } from "../components/ui";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";
import type { CalendarEvent } from "../types";

const today = new Date().toISOString().slice(0, 10);

type CategoryType = "All" | "Meeting" | "Deadline" | "Event";

const CATEGORIES: { label: string; value: CategoryType }[] = [
  { label: "Semua", value: "All" },
  { label: "Meeting", value: "Meeting" },
  { label: "Deadline", value: "Deadline" },
  { label: "Event", value: "Event" },
];

export function CalendarPage() {
  const { events, addEvent, updateEvent, deleteEvent } = useAppStore();
  const [range, setRange] = useState<[string, string]>([today, today]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryType>("All");
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    date: today,
    time: "09:00",
    type: "Meeting" as "Meeting" | "Deadline" | "Event",
  });

  // H-3 Reminders
  const reminders = events
    .map((event) => ({
      ...event,
      days: Math.ceil(
        (new Date(event.date).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000,
      ),
    }))
    .filter((event) => event.days >= 1 && event.days <= 3);

  // Filter events based on active category
  const filteredEvents =
    categoryFilter === "All"
      ? events
      : events.filter((event) => event.type === categoryFilter);

  // Selected date range events
  const selected = filteredEvents.filter(
    (event) => event.date >= range[0] && event.date <= range[1],
  );

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setForm({
      title: "",
      date: range[0] || today,
      time: "09:00",
      type: categoryFilter !== "All" ? categoryFilter : "Meeting",
    });
    setOpen(true);
  };

  const handleOpenEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      date: event.date,
      time: event.time,
      type: event.type,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, form);
        toast.success(`Agenda "${form.title}" berhasil diperbarui.`);
      } else {
        addEvent(form);
        toast.success(`Event "${form.title}" berhasil ditambahkan.`);
      }
      setOpen(false);
      setEditingEvent(null);
    } catch {
      toast.error("Gagal menyimpan agenda. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;
    setIsDeleting(true);
    try {
      await deleteEvent(deletingEvent.id);
      toast.success(`Agenda "${deletingEvent.title}" berhasil dihapus.`);
      setDeletingEvent(null);
    } catch {
      toast.error("Gagal menghapus agenda. Silakan coba lagi.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderBadge = (type: "Meeting" | "Deadline" | "Event") => {
    switch (type) {
      case "Meeting":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
            <Video size={10} /> Meeting
          </span>
        );
      case "Deadline":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle size={10} /> Deadline
          </span>
        );
      case "Event":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
            <CalendarDays size={10} /> Event
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Page */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rencanakan, kelola, revisi, dan atur agenda meeting, deadline, serta event.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} className="w-full sm:w-auto shadow-xs">
          <CalendarPlus size={15} /> Tambah event
        </Button>
      </div>

      {/* Reminder H-3 */}
      {reminders.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <BellRing size={16} /> Reminder H-3
            </div>
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              {reminders.length} agenda mendesak
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {reminders.map((event) => (
              <div
                key={event.id}
                onClick={() => setRange([event.date, event.date])}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white/80 p-3 transition hover:border-amber-300 hover:bg-white dark:border-amber-900/60 dark:bg-zinc-950/50 dark:hover:border-amber-700 dark:hover:bg-zinc-900"
                title="Klik untuk melihat di kalender"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    H-{event.days}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      {new Date(event.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      · {event.time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(event);
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    title="Edit agenda"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingEvent(event);
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                    title="Hapus agenda"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Calendar Grid & Agenda List */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-3 sm:p-5 flex flex-col justify-between">
          <div>
            <CalendarGrid events={filteredEvents} range={range} onRangeChange={setRange} />
          </div>

          {/* Quick legend for event dots */}
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span className="font-medium">Keterangan Titik Kalender:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-violet-500" /> Meeting
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Deadline
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Event
              </span>
            </div>
          </div>
        </Card>

        {/* Agenda Panel with Category Filter */}
        <Card className="flex flex-col overflow-hidden">
          {/* Header Panel */}
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Agenda pada tanggal terpilih</h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {range[0] === range[1]
                    ? new Date(range[0]).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : `${new Date(range[0]).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(range[1]).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`}
                  {" · "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {selected.length} kegiatan
                  </span>
                </p>
              </div>
              {range[0] !== today && (
                <button
                  onClick={() => setRange([today, today])}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  title="Kembali ke hari ini"
                >
                  <RotateCcw size={11} /> Hari ini
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="border-b border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                <Filter size={11} /> Filter Kategori
              </span>
              {categoryFilter !== "All" && (
                <button
                  onClick={() => setCategoryFilter("All")}
                  className="text-[10px] text-violet-600 hover:underline dark:text-violet-400"
                >
                  Reset filter
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {CATEGORIES.map((cat) => {
                const active = categoryFilter === cat.value;
                const count =
                  cat.value === "All"
                    ? events.length
                    : events.filter((e) => e.type === cat.value).length;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-2 py-1 text-xs font-medium transition",
                      active
                        ? "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500 shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
                    )}
                  >
                    <span className="truncate">{cat.label}</span>
                    <span
                      className={cn(
                        "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                        active
                          ? "bg-white/25 text-white"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda List */}
          <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900 max-h-[500px]">
            {selected.map((event) => (
              <div
                key={event.id}
                className="group p-4 transition hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {event.title}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Clock3 size={11} className="text-zinc-400" />
                      <span>{event.time}</span>
                      <span>·</span>
                      <span>
                        {new Date(event.date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {renderBadge(event.type)}

                    {/* Action buttons: Edit & Hapus */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(event)}
                        title="Revisi / Edit agenda"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300 transition"
                        aria-label={`Edit ${event.title}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setDeletingEvent(event)}
                        title="Hapus agenda"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
                        aria-label={`Hapus ${event.title}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                {event.type === "Meeting" && (
                  <button className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50/60 px-2.5 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-100/60 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/70 transition">
                    <Video size={11} /> Join meeting
                  </button>
                )}
              </div>
            ))}

            {!selected.length && (
              <div className="p-8 text-center">
                <p className="text-xs text-zinc-400">
                  {categoryFilter !== "All"
                    ? `Tidak ada agenda kategori "${categoryFilter}" pada tanggal ini.`
                    : "Tidak ada agenda pada tanggal terpilih."}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {categoryFilter !== "All" && (
                    <Button variant="secondary" onClick={() => setCategoryFilter("All")} className="text-xs">
                      Tampilkan semua kategori
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleOpenAdd} className="text-xs">
                    <CalendarPlus size={13} /> Tambah agenda
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modal Add / Edit Event */}
      {open && (
        <Modal
          title={editingEvent ? "Revisi / Edit Agenda" : "Tambah Event atau Meeting"}
          onClose={() => {
            setOpen(false);
            setEditingEvent(null);
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium">Judul Agenda</label>
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Contoh: Product sync, Sprint review, Submit laporan"
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium">Tanggal</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium">Waktu</label>
                <input
                  type="time"
                  className={inputClass}
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium">Kategori / Tipe</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as typeof form.type })
                }
              >
                <option value="Meeting">Meeting (Rapat / Diskusi)</option>
                <option value="Deadline">Deadline (Batas Waktu)</option>
                <option value="Event">Event (Kegiatan / Acara)</option>
              </select>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                onClick={() => {
                  setOpen(false);
                  setEditingEvent(null);
                }}
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={!form.title.trim() || isSubmitting}
                className="w-full sm:w-auto"
                onClick={handleSubmit}
              >
                {isSubmitting
                  ? "Menyimpan..."
                  : editingEvent
                    ? "Simpan Perubahan"
                    : "Simpan Event"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Confirmation Delete */}
      {deletingEvent && (
        <Modal title="Hapus Agenda" onClose={() => setDeletingEvent(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="space-y-1">
                <p className="font-semibold">Konfirmasi Penghapusan</p>
                <p>
                  Apakah Anda yakin ingin menghapus agenda{" "}
                  <strong className="font-semibold underline">"{deletingEvent.title}"</strong>?
                </p>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90">
                  Tindakan ini akan menghapus agenda dari kalender dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{deletingEvent.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span>
                  📅{" "}
                  {new Date(deletingEvent.date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span>·</span>
                <span>⏰ {deletingEvent.time}</span>
                <span>·</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Kategori: {deletingEvent.type}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                onClick={() => setDeletingEvent(null)}
                className="w-full sm:w-auto"
                disabled={isDeleting}
              >
                Batal
              </Button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex min-h-10 sm:min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {isDeleting ? "Menghapus..." : "Ya, Hapus Agenda"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
