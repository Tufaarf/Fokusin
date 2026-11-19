import { AlertCircle, Check, Loader2, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";
import type { Project, ProjectMemberDetail } from "../types";
import { Badge, Button, cn, inputClass, Modal } from "./ui";

interface ProjectMembersModalProps {
  projectId: string;
  onClose: () => void;
  onMemberAdded?: (email: string) => void;
  onMemberRemoved?: (email: string) => void;
}

export function ProjectMembersModal({
  projectId,
  onClose,
  onMemberAdded,
  onMemberRemoved,
}: ProjectMembersModalProps) {
  const { projects, currentUser, addProjectMember, removeProjectMember } = useAppStore();

  const project = projects.find((p) => p.id === projectId);

  const [inputEmail, setInputEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<
    { id: string | number; name: string; username?: string; email: string; avatar?: string | null }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Handle typing search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const query = inputEmail.trim();
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.friends.search(query);
        if (res?.data) {
          // Filter out users already in project
          const currentEmails = new Set(
            (project?.members || []).map((m) => m.toLowerCase()),
          );
          const filtered = res.data.filter(
            (u) => !currentEmails.has(u.email?.toLowerCase()),
          );
          setSuggestions(filtered);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [inputEmail, project?.members]);

  if (!project) {
    return (
      <Modal title="Kelola Anggota" onClose={onClose}>
        <div className="py-6 text-center text-sm text-zinc-500">
          Project tidak ditemukan.
        </div>
      </Modal>
    );
  }

  // Resolved list of members with rich details
  const memberList: {
    id?: string | number;
    name: string;
    username?: string;
    email: string;
    avatar?: string | null;
    isOwner: boolean;
  }[] = (project.members || []).map((email, idx) => {
    const detail = project.member_details?.find(
      (d) => d.email?.toLowerCase() === email.toLowerCase(),
    );

    const isOwner =
      detail?.role === "owner" ||
      (project.created_by && String(detail?.id) === String(project.created_by)) ||
      (idx === 0 && !project.created_by && (email === "you@acme.id" || email.includes("admin")));

    const name =
      detail?.name ||
      (email === currentUser?.email
        ? currentUser.name
        : email.split("@")[0].replace(/[._-]/g, " "));

    return {
      id: detail?.id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      username: detail?.username,
      email: email,
      avatar: detail?.avatar,
      isOwner: Boolean(isOwner),
    };
  });

  const handleAdd = async (emailToAdd?: string) => {
    const target = (emailToAdd || inputEmail).trim();
    setErrorMessage(null);

    if (!target) return;

    // Check if target is already a member
    if (
      project.members.some(
        (m) => m.toLowerCase() === target.toLowerCase(),
      )
    ) {
      setErrorMessage(`User "${target}" sudah menjadi anggota project ini.`);
      return;
    }

    setIsSubmitting(true);
    setShowSuggestions(false);
    try {
      await addProjectMember(project.id, target);
      toast.success(`Berhasil menambahkan ${target} ke project "${project.name}".`);
      setInputEmail("");
      setSuggestions([]);
      if (onMemberAdded) onMemberAdded(target);
    } catch (err: any) {
      const msg =
        err?.data?.errors?.email?.[0] ||
        err?.message ||
        "Gagal menambahkan anggota. Pastikan user telah terdaftar di sistem.";
      setErrorMessage(msg);
      toast.error(msg, "Gagal Menambahkan Anggota");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (member: (typeof memberList)[0]) => {
    if (member.isOwner) {
      toast.warning("Pemilik project (Owner) tidak dapat dihapus dari project.");
      return;
    }

    const confirmed = await confirmDialog({
      title: "Hapus Anggota Project",
      message: `Apakah Anda yakin ingin menghapus "${member.name}" (${member.email}) dari project "${project.name}"?`,
      description: "Anggota yang dihapus tidak akan dapat lagi mengakses board dan task pada project ini.",
      confirmText: "Ya, Hapus Anggota",
      cancelText: "Batal",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      await removeProjectMember(project.id, member.id || member.email);
      toast.success(`Anggota "${member.name}" berhasil dihapus dari project.`);
      if (onMemberRemoved) onMemberRemoved(member.email);
    } catch (err: any) {
      const msg = err?.message || "Gagal menghapus anggota dari project.";
      toast.error(msg, "Terjadi Kesalahan");
    }
  };

  return (
    <Modal title={`Anggota Project · ${project.name}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Header context info */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {project.name}
              </p>
              <p className="text-[11px] text-zinc-500">
                Total {project.members.length} anggota aktif pada project ini
              </p>
            </div>
          </div>
          <Badge className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
            Project Sedang Berjalan
          </Badge>
        </div>

        {/* Add Member Form */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Tambah Anggota Baru
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ketik username (contoh: alya_12) atau email..."
                  value={inputEmail}
                  onChange={(e) => {
                    setInputEmail(e.target.value);
                    setErrorMessage(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  className={cn(inputClass, "pr-8")}
                  disabled={isSubmitting}
                />
                {isSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                onClick={() => handleAdd()}
                disabled={!inputEmail.trim() || isSubmitting}
                className="shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <UserPlus size={15} />
                )}
                <span>Tambah</span>
              </Button>
            </div>

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  User Terdaftar di Sistem
                </p>
                {suggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAdd(user.username || user.email)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                        {user.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {user.name}
                        </p>
                        {user.username && (
                          <span className="font-mono text-[10px] text-violet-600 dark:text-violet-400">
                            @{user.username}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
                    </div>
                    <span className="text-[10px] text-violet-600 hover:underline dark:text-violet-400">
                      + Pilih
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Anggota yang ditambahkan akan otomatis dihubungkan ke Group Chat project dan dapat diberikan penugasan task.
          </p>
        </div>

        {/* Existing Members List */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Daftar Anggota Saat Ini ({memberList.length})
            </h3>
          </div>

          <div className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {memberList.map((member) => {
              const isCurrentUser =
                currentUser?.email &&
                member.email.toLowerCase() === currentUser.email.toLowerCase();

              return (
                <div
                  key={member.email}
                  className="flex items-center justify-between gap-3 p-3 transition hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          member.isOwner
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                        )}
                      >
                        {member.name[0]?.toUpperCase() || member.email[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {member.name}
                        </p>
                        {member.username && (
                          <span className="font-mono text-[10px] text-violet-600 dark:text-violet-400">
                            @{member.username}
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-[10px] text-zinc-400">(Anda)</span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-zinc-500">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.isOwner ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-400">
                        Owner
                      </span>
                    ) : (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                        Member
                      </span>
                    )}

                    {!member.isOwner ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        title={`Hapus ${member.name} dari project`}
                        className="rounded p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <div className="w-7" /> // spacing placeholder
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Selesai
          </Button>
        </div>
      </div>
    </Modal>
  );
}
