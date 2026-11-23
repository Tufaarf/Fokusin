import type { GoogleDocumentType } from "../types";

export interface ParsedGoogleUrl {
  isValid: boolean;
  type: GoogleDocumentType;
  fileId: string;
  embedUrl: string;
  suggestedTitle: string;
  normalizedUrl: string;
  error?: string;
}

/**
 * Ekstraksi ID dan tipe dokumen dari URL Google Docs / Sheets / Slides / Drive.
 */
export function parseGoogleDocumentUrl(rawUrl: string): ParsedGoogleUrl {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      isValid: false,
      type: "docs",
      fileId: "",
      embedUrl: "",
      suggestedTitle: "",
      normalizedUrl: "",
      error: "URL tidak boleh kosong",
    };
  }

  const cleanUrl = rawUrl.trim();

  // 1. Google Spreadsheets / Sheets
  const sheetsMatch = cleanUrl.match(
    /(?:docs\.google\.com\/spreadsheets\/d\/)([a-zA-Z0-9_-]+)/i,
  );
  if (sheetsMatch && sheetsMatch[1]) {
    const fileId = sheetsMatch[1];
    return {
      isValid: true,
      type: "sheets",
      fileId,
      embedUrl: `https://docs.google.com/spreadsheets/d/${fileId}/edit?embedded=true`,
      suggestedTitle: "Spreadsheet Tanpa Judul",
      normalizedUrl: `https://docs.google.com/spreadsheets/d/${fileId}/edit`,
    };
  }

  // 2. Google Docs
  const docsMatch = cleanUrl.match(
    /(?:docs\.google\.com\/document\/d\/)([a-zA-Z0-9_-]+)/i,
  );
  if (docsMatch && docsMatch[1]) {
    const fileId = docsMatch[1];
    return {
      isValid: true,
      type: "docs",
      fileId,
      embedUrl: `https://docs.google.com/document/d/${fileId}/edit?embedded=true`,
      suggestedTitle: "Dokumen Tanpa Judul",
      normalizedUrl: `https://docs.google.com/document/d/${fileId}/edit`,
    };
  }

  // 3. Google Slides (Presentasi)
  const slidesMatch = cleanUrl.match(
    /(?:docs\.google\.com\/presentation\/d\/)([a-zA-Z0-9_-]+)/i,
  );
  if (slidesMatch && slidesMatch[1]) {
    const fileId = slidesMatch[1];
    return {
      isValid: true,
      type: "slides",
      fileId,
      embedUrl: `https://docs.google.com/presentation/d/${fileId}/edit?embedded=true`,
      suggestedTitle: "Presentasi Tanpa Judul",
      normalizedUrl: `https://docs.google.com/presentation/d/${fileId}/edit`,
    };
  }

  // 4. Google Forms
  const formsMatch = cleanUrl.match(
    /(?:docs\.google\.com\/forms\/d\/(?:e\/)?)([a-zA-Z0-9_-]+)/i,
  );
  if (formsMatch && formsMatch[1]) {
    const fileId = formsMatch[1];
    return {
      isValid: true,
      type: "forms",
      fileId,
      embedUrl: `https://docs.google.com/forms/d/e/${fileId}/viewform?embedded=true`,
      suggestedTitle: "Formulir Google",
      normalizedUrl: cleanUrl,
    };
  }

  // 5. Google Drive Generic File
  const driveMatch = cleanUrl.match(
    /(?:drive\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/i,
  );
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return {
      isValid: true,
      type: "drive",
      fileId,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      suggestedTitle: "File Google Drive",
      normalizedUrl: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  return {
    isValid: false,
    type: "docs",
    fileId: "",
    embedUrl: "",
    suggestedTitle: "",
    normalizedUrl: cleanUrl,
    error: "Format link tidak dikenali. Pastikan memasukkan URL Google Docs, Spreadsheet, atau Slides.",
  };
}

/**
 * Hasilkan URL embedding sesuai mode (Edit atau Pratinjau/Preview)
 */
export function getGoogleEmbedUrl(
  fileId: string,
  type: GoogleDocumentType,
  mode: "edit" | "preview" = "edit",
): string {
  if (!fileId) return "";

  if (type === "sheets") {
    return mode === "preview"
      ? `https://docs.google.com/spreadsheets/d/${fileId}/preview`
      : `https://docs.google.com/spreadsheets/d/${fileId}/edit?embedded=true`;
  }

  if (type === "docs") {
    return mode === "preview"
      ? `https://docs.google.com/document/d/${fileId}/preview`
      : `https://docs.google.com/document/d/${fileId}/edit?embedded=true`;
  }

  if (type === "slides") {
    return mode === "preview"
      ? `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`
      : `https://docs.google.com/presentation/d/${fileId}/edit?embedded=true`;
  }

  if (type === "forms") {
    return `https://docs.google.com/forms/d/e/${fileId}/viewform?embedded=true`;
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Informasi UI & konfigurasi warna per tipe Google Document
 */
export function getDocTypeConfig(type: GoogleDocumentType) {
  switch (type) {
    case "sheets":
      return {
        label: "Google Sheets",
        shortLabel: "Spreadsheet",
        color: "#0F9D58",
        bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
        badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        borderAccent: "border-l-emerald-500",
        bannerBg: "bg-gradient-to-r from-emerald-600 to-teal-700",
      };
    case "docs":
      return {
        label: "Google Docs",
        shortLabel: "Dokumen Teks",
        color: "#4285F4",
        bgLight: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
        badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
        iconColor: "text-blue-600 dark:text-blue-400",
        borderAccent: "border-l-blue-500",
        bannerBg: "bg-gradient-to-r from-blue-600 to-indigo-700",
      };
    case "slides":
      return {
        label: "Google Slides",
        shortLabel: "Presentasi",
        color: "#F4B400",
        bgLight: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
        badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
        iconColor: "text-amber-600 dark:text-amber-400",
        borderAccent: "border-l-amber-500",
        bannerBg: "bg-gradient-to-r from-amber-500 to-orange-600",
      };
    case "forms":
      return {
        label: "Google Forms",
        shortLabel: "Formulir",
        color: "#7248B9",
        bgLight: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
        badgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300",
        iconColor: "text-purple-600 dark:text-purple-400",
        borderAccent: "border-l-purple-500",
        bannerBg: "bg-gradient-to-r from-purple-600 to-indigo-700",
      };
    default:
      return {
        label: "Google Drive",
        shortLabel: "File Drive",
        color: "#4285F4",
        bgLight: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
        badgeBg: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
        iconColor: "text-zinc-600 dark:text-zinc-400",
        borderAccent: "border-l-zinc-500",
        bannerBg: "bg-gradient-to-r from-zinc-600 to-zinc-800",
      };
  }
}
