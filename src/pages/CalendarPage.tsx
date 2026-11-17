import { BellRing, CalendarPlus, Clock3, Video } from "lucide-react";
import { useState } from "react";
import { CalendarGrid } from "../components/CalendarGrid";
import { Badge, Button, Card, inputClass, Modal } from "../components/ui";
import { useAppStore } from "../store";

const today = new Date().toISOString().slice(0, 10);

export function CalendarPage() {
  const { events, addEvent } = useAppStore();
  const [range, setRange] = useState<[string, string]>([today, today]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: today,
    time: "09:00",
    type: "Meeting" as "Meeting" | "Deadline" | "Event",
  });
  const reminders = events
    .map((event) => ({
      ...event,
      days: Math.ceil(
        (new Date(event.date).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000,
      ),
    }))
    .filter((event) => event.days >= 1 && event.days <= 3);
  const selected = events.filter((event) => event.date >= range[0] && event.date <= range[1]);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">Rencanakan meeting, event, dan deadline.</p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <CalendarPlus size={15} /> Tambah event
        </Button>
      </div>
      {reminders.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <BellRing size={16} /> Reminder H-3
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {reminders.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white/70 p-3 dark:border-amber-900/60 dark:bg-zinc-950/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  H-{event.days}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{event.title}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {new Date(event.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {event.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-3 sm:p-5">
          <CalendarGrid events={events} range={range} onRangeChange={setRange} />
        </Card>
        <Card>
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Agenda pada tanggal terpilih</h2>
            <p className="mt-1 text-[11px] text-zinc-500">{selected.length} kegiatan ditemukan</p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {selected.map((event) => (
              <div key={event.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium">{event.title}</p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
                      <Clock3 size={11} /> {event.time} ·{" "}
                      {new Date(event.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                  </div>
                  <Badge>{event.type}</Badge>
                </div>
                {event.type === "Meeting" && (
                  <button className="mt-3 flex items-center gap-1 text-[10px] font-medium text-violet-600">
                    <Video size={11} /> Join meeting
                  </button>
                )}
              </div>
            ))}
            {!selected.length && (
              <p className="p-8 text-center text-xs text-zinc-400">Pilih tanggal dengan agenda</p>
            )}
          </div>
        </Card>
      </div>
      {open && (
        <Modal title="Tambah event atau meeting" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium">Judul</label>
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Product sync"
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
              <label className="mb-2 block text-xs font-medium">Tipe</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as typeof form.type })
                }
              >
                <option>Meeting</option>
                <option>Event</option>
                <option>Deadline</option>
              </select>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={!form.title}
                className="w-full sm:w-auto"
                onClick={() => {
                  addEvent(form);
                  setOpen(false);
                }}
              >
                Simpan event
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
