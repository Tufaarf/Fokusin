import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  FileCode,
  Minus,
  Eraser,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { cn } from "./ui";

interface WysiwygEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
  className?: string;
}

export function WysiwygEditor({
  content,
  onChange,
  placeholder = "Mulai tulis catatan Anda di sini...",
  editable = true,
  minHeight = "min-h-[260px]",
  className,
}: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap focus:outline-none px-4 py-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100",
          minHeight,
        ),
      },
    },
  });

  // Sync content if changed from outside (e.g. switching between different notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Update editable mode if prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900",
          className,
        )}
      >
        Memuat editor catatan...
      </div>
    );
  }

  const rawText = editor.getText();
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const charCount = rawText.length;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-zinc-200 bg-white transition-colors dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50/75 p-2 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          {/* Headings */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1"
              aria-label="Heading 1"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("heading", { level: 1 }) &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Heading1 size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
              aria-label="Heading 2"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("heading", { level: 2 }) &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Heading2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
              aria-label="Heading 3"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("heading", { level: 3 }) &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Heading3 size={16} />
            </button>
          </div>

          {/* Text Styling */}
          <div className="flex items-center gap-0.5 px-1 border-r border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Tebal (Ctrl+B)"
              aria-label="Tebal"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("bold") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Miring (Ctrl+I)"
              aria-label="Miring"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("italic") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Italic size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Garis Bawah (Ctrl+U)"
              aria-label="Garis Bawah"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("underline") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <UnderlineIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Coret (Strikethrough)"
              aria-label="Coret"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("strike") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Strikethrough size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              title="Kode Inline"
              aria-label="Kode Inline"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("code") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Code size={16} />
            </button>
          </div>

          {/* Lists & Quotes */}
          <div className="flex items-center gap-0.5 px-1 border-r border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Daftar Poin (Bullet List)"
              aria-label="Daftar Poin"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("bulletList") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Daftar Angka (Ordered List)"
              aria-label="Daftar Angka"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("orderedList") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <ListOrdered size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Kutipan (Blockquote)"
              aria-label="Kutipan"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("blockquote") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <Quote size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="Blok Kode (Code Block)"
              aria-label="Blok Kode"
              className={cn(
                "rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                editor.isActive("codeBlock") &&
                  "bg-violet-100 font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
              )}
            >
              <FileCode size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Garis Pembatas (Divider)"
              aria-label="Garis Pembatas"
              className="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Minus size={16} />
            </button>
          </div>

          {/* History & Reset */}
          <div className="flex items-center gap-0.5 pl-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Urungkan (Undo)"
              aria-label="Undo"
              className="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Ulangi (Redo)"
              aria-label="Redo"
              className="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <RotateCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Hapus Pemformatan"
              aria-label="Hapus Pemformatan"
              className="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Eraser size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div
        className="relative flex-1 cursor-text overflow-y-auto"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-zinc-200/80 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        <span className="flex items-center gap-3">
          <span>{wordCount} kata</span>
          <span>·</span>
          <span>{charCount} karakter</span>
        </span>
        <span className="text-[10px]">WYSIWYG Rich Text</span>
      </div>
    </div>
  );
}
