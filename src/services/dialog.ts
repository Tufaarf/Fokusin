import { create } from "zustand";

export type DialogVariant = "danger" | "warning" | "info" | "primary";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface PromptDialogOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: "text" | "url" | "email";
}

interface DialogState {
  // Confirm state
  isConfirmOpen: boolean;
  confirmOptions: ConfirmDialogOptions;
  confirmResolve: ((value: boolean) => void) | null;

  // Prompt state
  isPromptOpen: boolean;
  promptOptions: PromptDialogOptions;
  promptValue: string;
  promptResolve: ((value: string | null) => void) | null;

  // Actions
  openConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;

  openPrompt: (options: PromptDialogOptions) => Promise<string | null>;
  setPromptValue: (val: string) => void;
  resolvePrompt: (value: string | null) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isConfirmOpen: false,
  confirmOptions: {
    title: "Konfirmasi",
    message: "",
    confirmText: "Ya, Lanjutkan",
    cancelText: "Batal",
    variant: "danger",
  },
  confirmResolve: null,

  isPromptOpen: false,
  promptOptions: {
    title: "Input",
    message: "",
    placeholder: "",
    defaultValue: "",
    confirmText: "Simpan",
    cancelText: "Batal",
    inputType: "text",
  },
  promptValue: "",
  promptResolve: null,

  openConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isConfirmOpen: true,
        confirmOptions: {
          title: options.title || "Konfirmasi Tindakan",
          message: options.message,
          description: options.description,
          confirmText: options.confirmText || "Konfirmasi",
          cancelText: options.cancelText || "Batal",
          variant: options.variant || "danger",
        },
        confirmResolve: resolve,
      });
    });
  },

  resolveConfirm: (value: boolean) => {
    const { confirmResolve } = get();
    if (confirmResolve) confirmResolve(value);
    set({ isConfirmOpen: false, confirmResolve: null });
  },

  openPrompt: (options) => {
    return new Promise<string | null>((resolve) => {
      set({
        isPromptOpen: true,
        promptOptions: {
          title: options.title || "Masukkan Nilai",
          message: options.message,
          placeholder: options.placeholder || "",
          defaultValue: options.defaultValue || "",
          confirmText: options.confirmText || "Simpan",
          cancelText: options.cancelText || "Batal",
          inputType: options.inputType || "text",
        },
        promptValue: options.defaultValue || "",
        promptResolve: resolve,
      });
    });
  },

  setPromptValue: (val: string) => set({ promptValue: val }),

  resolvePrompt: (value: string | null) => {
    const { promptResolve } = get();
    if (promptResolve) promptResolve(value);
    set({ isPromptOpen: false, promptResolve: null });
  },
}));

/**
 * Custom modern confirmation dialog matching the Fokusin design system.
 * Returns a promise that resolves to true (confirmed) or false (cancelled).
 */
export function confirmDialog(options: ConfirmDialogOptions | string): Promise<boolean> {
  if (typeof options === "string") {
    return useDialogStore.getState().openConfirm({ message: options });
  }
  return useDialogStore.getState().openConfirm(options);
}

/**
 * Custom modern prompt dialog matching the Fokusin design system.
 * Returns a promise that resolves to the input string, or null if cancelled.
 */
export function promptDialog(options: PromptDialogOptions | string): Promise<string | null> {
  if (typeof options === "string") {
    return useDialogStore.getState().openPrompt({ message: options });
  }
  return useDialogStore.getState().openPrompt(options);
}
