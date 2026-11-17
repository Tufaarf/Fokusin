import { X } from "lucide-react";
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export const cn = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "primary";
};

export function Button({ className, variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9",
        variant === "primary"
          ? "border-violet-600 bg-violet-600 text-white hover:border-violet-700 hover:bg-violet-700 dark:border-violet-500 dark:bg-violet-500 dark:text-white dark:hover:border-violet-400 dark:hover:bg-violet-400"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: PropsWithChildren<{ title: string; onClose: () => void; wide?: boolean }>) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 backdrop-blur-[2px] sm:items-center sm:p-3"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          "max-h-[96dvh] w-full overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:max-h-[92vh] sm:rounded-xl",
          wide ? "max-w-3xl" : "max-w-md",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800 sm:px-5">
          <h2 className="truncate pr-3 font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Tutup modal"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[calc(96dvh-3.5rem)] overflow-y-auto p-4 sm:max-h-[calc(92vh-3.5rem)] sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-zinc-200 bg-transparent px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600";
