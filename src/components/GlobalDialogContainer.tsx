import { AlertCircle, AlertTriangle, HelpCircle, Link as LinkIcon, Trash2, X } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { useDialogStore } from "../services/dialog";
import { Button, cn, inputClass } from "./ui";

export function ConfirmDialog() {
  const { isConfirmOpen, confirmOptions, resolveConfirm } = useDialogStore();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isConfirmOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        resolveConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => confirmBtnRef.current?.focus(), 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isConfirmOpen, resolveConfirm]);

  if (!isConfirmOpen) return null;

  const isDanger = confirmOptions.variant === "danger";
  const isWarning = confirmOptions.variant === "warning";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={() => resolveConfirm(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              isDanger && "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
              isWarning && "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
              !isDanger &&
                !isWarning &&
                "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
            )}
          >
            {isDanger ? (
              <Trash2 size={22} />
            ) : isWarning ? (
              <AlertTriangle size={22} />
            ) : (
              <HelpCircle size={22} />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              {confirmOptions.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              {confirmOptions.message}
            </p>
            {confirmOptions.description && (
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {confirmOptions.description}
              </p>
            )}
          </div>

          <button
            onClick={() => resolveConfirm(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => resolveConfirm(false)}
            className="w-full sm:w-auto"
          >
            {confirmOptions.cancelText || "Batal"}
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            variant="primary"
            onClick={() => resolveConfirm(true)}
            className={cn(
              "w-full sm:w-auto",
              isDanger &&
                "border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700 dark:border-rose-600 dark:bg-rose-600 dark:hover:border-rose-500 dark:hover:bg-rose-500",
              isWarning &&
                "border-amber-600 bg-amber-600 text-white hover:border-amber-700 hover:bg-amber-700",
            )}
          >
            {confirmOptions.confirmText || "Konfirmasi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PromptDialog() {
  const { isPromptOpen, promptOptions, promptValue, setPromptValue, resolvePrompt } =
    useDialogStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPromptOpen) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        resolvePrompt(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isPromptOpen, resolvePrompt]);

  if (!isPromptOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resolvePrompt(promptValue);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={() => resolvePrompt(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
            <LinkIcon size={20} />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              {promptOptions.title}
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{promptOptions.message}</p>
          </div>

          <button
            onClick={() => resolvePrompt(null)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <input
            ref={inputRef}
            type={promptOptions.inputType || "text"}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder={promptOptions.placeholder}
            className={inputClass}
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => resolvePrompt(null)}
              className="w-full sm:w-auto"
            >
              {promptOptions.cancelText || "Batal"}
            </Button>
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              {promptOptions.confirmText || "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GlobalDialogContainer() {
  return (
    <>
      <ConfirmDialog />
      <PromptDialog />
    </>
  );
}
