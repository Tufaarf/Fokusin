import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalendarEvent } from "../types";
import { cn } from "./ui";

type Props = {
  events: CalendarEvent[];
  range: [string, string];
  onRangeChange: (range: [string, string]) => void;
};

export function CalendarGrid({ events, range, onRangeChange }: Props) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [year, month]);
  const select = (iso: string) => {
    if (range[0] && range[1] && range[0] !== range[1]) onRangeChange([iso, iso]);
    else if (iso < range[0]) onRangeChange([iso, range[0]]);
    else onRangeChange([range[0], iso]);
  };
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {viewDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          </h3>
          <p className="text-[11px] text-zinc-500">Klik tanggal awal dan akhir</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
          <div className="pb-2" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const selected = iso >= range[0] && iso <= range[1];
          const today = iso === new Date().toISOString().slice(0, 10);
          const dayEvents = events.filter((event) => event.date === iso);
          const hasEvent = dayEvents.length > 0;
          return (
            <button
              key={iso}
              onClick={() => select(iso)}
              className={cn(
                "relative flex aspect-square min-h-9 items-center justify-center border-y border-transparent text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-900",
                date.getMonth() !== month && "text-zinc-300 dark:text-zinc-700",
                selected && "border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900",
                iso === range[0] && "rounded-l-lg",
                iso === range[1] && "rounded-r-lg",
                today && "font-bold text-violet-600 dark:text-violet-400",
              )}
            >
              {date.getDate()}
              {hasEvent && (
                <div className="absolute bottom-1 flex items-center justify-center gap-0.5">
                  {Array.from(new Set(dayEvents.map((e) => e.type)))
                    .slice(0, 3)
                    .map((type) => (
                      <span
                        key={type}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          type === "Meeting" && "bg-violet-500",
                          type === "Deadline" && "bg-rose-500",
                          type === "Event" && "bg-sky-500",
                        )}
                      />
                    ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
