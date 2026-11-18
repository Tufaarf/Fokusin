import { Bold, Image, Italic, Link, List, Paperclip, Play, Trash2, Underline, Users } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../store";
import type { Task } from "../types";
import { Badge, Button, Modal } from "./ui";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";
import { ProjectMembersModal } from "./ProjectMembersModal";

export function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const project = useAppStore((state) => state.projects.find((item) => item.id === task.projectId));
  const [description, setDescription] = useState(task.description);
  const [attachments, setAttachments] = useState(task.attachments ?? []);
  const [assignee, setAssignee] = useState(task.assignee);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  const upload = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .map((file) => ({
        name: file.name,
        type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
        url: URL.createObjectURL(file),
      }));
    setAttachments((current) => [...current, ...next]);
  };

  const save = () => {
    updateTask(task.id, { description, attachments, assignee });
    toast.success("Perubahan task berhasil disimpan.");
    onClose();
  };
  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: "Hapus Task",
      message: `Apakah Anda yakin ingin menghapus task "${task.title}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      variant: "danger",
    });
    if (confirmed) {
      await deleteTask(task.id);
      toast.success("Task berhasil dihapus.");
      onClose();
    }
  };
  return (
    <Modal title={`${task.id} · Detail task`} onClose={onClose} wide>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{task.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{project?.name}</p>
        </div>
        <Badge
          className={
            task.priority === "High"
              ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40"
              : ""
          }
        >
          {task.priority} priority
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 border-y border-zinc-200 py-4 text-xs dark:border-zinc-800 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-zinc-500">Assignee</p>
            {project && (
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(true)}
                className="text-[10px] font-medium text-violet-600 hover:underline dark:text-violet-400"
                title="Kelola anggota project ini"
              >
                + Kelola
              </button>
            )}
          </div>
          {project ? (
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="mt-1 h-8 w-full rounded border border-zinc-200 bg-transparent px-2 text-xs font-medium outline-none transition focus:border-violet-500 dark:border-zinc-800"
            >
              {project.members.map((member) => (
                <option key={member} value={member} className="dark:bg-zinc-900">
                  {member}
                </option>
              ))}
              {!project.members.includes(assignee) && assignee !== "Unassigned" && (
                <option value={assignee} className="dark:bg-zinc-900">
                  {assignee}
                </option>
              )}
              <option value="Unassigned" className="dark:bg-zinc-900">
                Unassigned
              </option>
            </select>
          ) : (
            <p className="mt-1 font-medium">{assignee}</p>
          )}
        </div>
        <div>
          <p className="text-zinc-500">Status</p>
          <p className="mt-1 font-medium capitalize">{task.status}</p>
        </div>
        <div>
          <p className="text-zinc-500">Due date</p>
          <p className="mt-1 font-medium">
            {new Date(task.dueDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold">Deskripsi pengerjaan</label>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-1 border-b border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
            {[Bold, Italic, Underline, Link, List].map((Icon, index) => (
              <button
                key={index}
                className="rounded p-1.5 text-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-32 w-full resize-y bg-transparent p-3 text-sm leading-relaxed outline-none"
          />
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold">Lampiran media</label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-violet-600">
            <Paperclip size={14} /> Tambah file
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => upload(event.target.files)}
            />
          </label>
        </div>
        {attachments.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((file) => (
              <div
                key={file.url}
                className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                {file.type === "image" ? (
                  <img src={file.url} alt={file.name} className="h-28 w-full object-cover" />
                ) : (
                  <video src={file.url} controls className="h-28 w-full bg-black object-cover" />
                )}
                <p className="truncate p-2 text-[11px]">{file.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
            <Image size={20} />
            <span className="mt-2 text-xs">Upload foto atau video</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => upload(event.target.files)}
            />
          </label>
        )}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <Trash2 size={13} /> Hapus task
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Batal
          </Button>
          <Button variant="primary" onClick={save} className="w-full sm:w-auto">
            Simpan perubahan
          </Button>
        </div>
      </div>
      {isMembersModalOpen && project && (
        <ProjectMembersModal
          projectId={project.id}
          onClose={() => setIsMembersModalOpen(false)}
          onMemberAdded={(newEmail) => {
            setAssignee(newEmail);
          }}
        />
      )}
    </Modal>
  );
}
