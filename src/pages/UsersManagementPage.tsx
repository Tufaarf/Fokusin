import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, inputClass, Modal } from "../components/ui";
import { api } from "../services/api";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";
import type { User } from "../types";

export function UsersManagementPage() {
  const { currentUser } = useAppStore();
  const isSuper = currentUser?.role === "superadmin" || currentUser?.is_superadmin;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "superadmin" | "user">("all");

  // Modal Create
  const [openCreate, setOpenCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"user" | "superadmin">("user");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Modal Edit
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "superadmin">("user");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.users.list();
      if (res?.data && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch (err: any) {
      console.warn("Could not fetch users from backend, fallback to local/mock:", err);
      // Fallback data if backend is offline
      if (users.length === 0) {
        setUsers([
          {
            id: currentUser?.id || 1,
            name: currentUser?.name || "Super Admin",
            email: currentUser?.email || "superadmin@acme.id",
            role: "superadmin",
            is_superadmin: true,
            tasks_count: 5,
            projects_count: 3,
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            name: "Daffa Thufail Arrofi",
            email: "daffa.rfai@gmail.com",
            role: "user",
            is_superadmin: false,
            tasks_count: 8,
            projects_count: 2,
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          },
          {
            id: 3,
            name: "Naya Putri",
            email: "naya@acme.id",
            role: "user",
            is_superadmin: false,
            tasks_count: 4,
            projects_count: 1,
            created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          },
          {
            id: 4,
            name: "Rehan Ahmad",
            email: "rehan@acme.id",
            role: "user",
            is_superadmin: false,
            tasks_count: 6,
            projects_count: 2,
            created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuper) {
      fetchUsers();
    }
  }, [isSuper]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q.replace(/^@/, ""))) ||
        u.email.toLowerCase().includes(q);
      const isUserSuper = u.role === "superadmin" || u.is_superadmin;
      const matchesRole =
        roleFilter === "all" ? true : roleFilter === "superadmin" ? isUserSuper : !isUserSuper;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const superadmins = users.filter((u) => u.role === "superadmin" || u.is_superadmin).length;
    const regular = total - superadmins;
    return { total, superadmins, regular };
  }, [users]);

  // Handle Create User
  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || createName.trim().length < 2) {
      toast.error("Nama pengguna harus minimal 2 karakter.", "Validasi Gagal");
      return;
    }
    if (!createEmail.trim() || !createEmail.includes("@")) {
      toast.error("Alamat email tidak valid.", "Validasi Gagal");
      return;
    }
    if (!createPassword || createPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.", "Validasi Gagal");
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await api.users.create({
        name: createName.trim(),
        username: createUsername.trim().toLowerCase().replace(/^@/, "") || undefined,
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
      });

      const newUser: User = res.data || {
        id: Date.now(),
        name: createName.trim(),
        username: createUsername.trim().toLowerCase().replace(/^@/, "") || undefined,
        email: createEmail.trim(),
        role: createRole,
        is_superadmin: createRole === "superadmin",
        created_at: new Date().toISOString(),
      };

      setUsers((prev) => [newUser, ...prev]);
      toast.success(`User "${createName.trim()}" berhasil dibuat.`, "User Ditambahkan");
      setOpenCreate(false);
      setCreateName("");
      setCreateUsername("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("user");
    } catch (err: any) {
      const msg =
        err?.data?.errors?.username?.[0] ||
        err?.data?.errors?.email?.[0] ||
        err?.data?.errors?.name?.[0] ||
        err?.data?.errors?.password?.[0] ||
        err?.data?.message ||
        err?.message ||
        "Gagal menambahkan user baru. Silakan periksa kembali formulir.";
      toast.error(msg, "Gagal Menambahkan");
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username || "");
    setEditEmail(user.email);
    setEditRole(user.role === "superadmin" || user.is_superadmin ? "superadmin" : "user");
    setEditPassword("");
    setShowEditPassword(false);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser?.id) return;

    if (!editName.trim() || editName.trim().length < 2) {
      toast.error("Nama pengguna harus minimal 2 karakter.", "Validasi Gagal");
      return;
    }
    if (!editEmail.trim() || !editEmail.includes("@")) {
      toast.error("Alamat email tidak valid.", "Validasi Gagal");
      return;
    }
    if (editPassword && editPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.", "Validasi Gagal");
      return;
    }

    try {
      setSubmittingEdit(true);
      const cleanUsername = editUsername.trim().toLowerCase().replace(/^@/, "");
      const payload: any = {
        name: editName.trim(),
        username: cleanUsername || undefined,
        email: editEmail.trim(),
        role: editRole,
      };
      if (editPassword) {
        payload.password = editPassword;
      }

      await api.users.update(editingUser.id, payload);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: editName.trim(),
                username: cleanUsername || u.username,
                email: editEmail.trim(),
                role: editRole,
                is_superadmin: editRole === "superadmin",
              }
            : u,
        ),
      );

      toast.success(`Data user "${editName.trim()}" berhasil diperbarui.`, "User Diperbarui");
      setEditingUser(null);
    } catch (err: any) {
      const msg =
        err?.data?.errors?.username?.[0] ||
        err?.data?.errors?.email?.[0] ||
        err?.data?.errors?.name?.[0] ||
        err?.data?.errors?.password?.[0] ||
        err?.data?.message ||
        err?.message ||
        "Gagal memperbarui data user.";
      toast.error(msg, "Gagal Memperbarui");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user: User) => {
    if (String(user.id) === String(currentUser?.id) || user.email === currentUser?.email) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri.", "Aksi Ditolak");
      return;
    }

    if (user.email === "superadmin@acme.id" || user.email === "admin@fokusin.com") {
      toast.error(
        "Akun Superadmin utama sistem dilindungi dan tidak dapat dihapus.",
        "Aksi Ditolak",
      );
      return;
    }

    const confirmed = await confirmDialog({
      title: "Hapus Pengguna",
      message: `Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.email})? Seluruh data terkait pengguna ini akan dihapus permanen.`,
      confirmText: "Hapus Pengguna",
      cancelText: "Batal",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      if (user.id) {
        await api.users.delete(user.id);
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`User "${user.name}" berhasil dihapus dari sistem.`, "User Dihapus");
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Gagal menghapus user dari sistem.";
      toast.error(msg, "Gagal Menghapus");
    }
  };

  if (!isSuper) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Akses Khusus Superadmin</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Halaman Manajemen Pengguna hanya dapat diakses oleh akun dengan peran Super Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Manajemen Pengguna</h1>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
              🛡️ Superadmin Panel
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Kelola data seluruh akun anggota, peran (roles), izin akses, serta tambah atau hapus
            pengguna.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button onClick={fetchUsers} disabled={loading} title="Refresh data">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Segarkan</span>
          </Button>

          <Button variant="primary" onClick={() => setOpenCreate(true)}>
            <Plus size={16} /> Tambah User Baru
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Total Pengguna</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Users size={16} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</p>
          <p className="mt-1 text-[11px] text-zinc-400">Akun terdaftar dalam database</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Super Administrator</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-violet-600 dark:text-violet-400">
            {stats.superadmins}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">Memiliki hak akses penuh & kelola user</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Pengguna Reguler</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <UserIcon size={16} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight">{stats.regular}</p>
          <p className="mt-1 text-[11px] text-zinc-400">Anggota tim & kolaborator proyek</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari pengguna berdasarkan nama atau email..."
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setRoleFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                roleFilter === "all"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Semua ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter("superadmin")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                roleFilter === "superadmin"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Superadmin ({stats.superadmins})
            </button>
            <button
              onClick={() => setRoleFilter("user")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                roleFilter === "user"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              User ({stats.regular})
            </button>
          </div>
        </div>
      </Card>

      {/* Users Table / List */}
      <Card className="overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <RefreshCw size={18} className="animate-spin text-violet-600" />
              <span>Memuat data pengguna...</span>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <UserIcon size={32} className="text-zinc-300 dark:text-zinc-700" />
            <p className="mt-2 text-sm font-medium">Tidak ada pengguna yang cocok</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Coba sesuaikan kata kunci pencarian atau ganti filter peran.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-xs font-medium text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-5 py-3.5">Pengguna</th>
                  <th className="px-5 py-3.5">Peran / Role</th>
                  <th className="hidden px-5 py-3.5 md:table-cell">Aktivitas</th>
                  <th className="hidden px-5 py-3.5 lg:table-cell">Terdaftar</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredUsers.map((u) => {
                  const isCurrent =
                    String(u.id) === String(currentUser?.id) || u.email === currentUser?.email;
                  const isUserSuper = u.role === "superadmin" || u.is_superadmin;
                  const uInitials = u.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="group transition hover:bg-zinc-50/75 dark:hover:bg-zinc-900/40"
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                            {uInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                                {u.name}
                              </span>
                              {u.username && (
                                <span className="font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">
                                  @{u.username}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="truncate text-xs text-zinc-500 block">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isUserSuper ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
                            <ShieldCheck size={13} /> Superadmin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            <UserIcon size={13} /> User
                          </span>
                        )}
                      </td>

                      {/* Activity */}
                      <td className="hidden px-5 py-4 text-xs text-zinc-500 md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span>{u.tasks_count ?? 0} Tasks</span>
                          <span>·</span>
                          <span>{u.projects_count ?? 0} Proyek</span>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="hidden px-5 py-4 text-xs text-zinc-500 lg:table-cell whitespace-nowrap">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition"
                            title="Edit data user"
                            aria-label={`Edit data ${u.name}`}
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={
                              isCurrent ||
                              u.email === "superadmin@acme.id" ||
                              u.email === "admin@fokusin.com"
                            }
                            className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title={
                              isCurrent
                                ? "Tidak dapat menghapus akun Anda sendiri"
                                : u.email === "superadmin@acme.id" ||
                                    u.email === "admin@fokusin.com"
                                  ? "Akun sistem dilindungi"
                                  : "Hapus user"
                            }
                            aria-label={`Hapus user ${u.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Tambah User */}
      {openCreate && (
        <Modal title="Tambah Pengguna Baru" onClose={() => setOpenCreate(false)}>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="add-name">
                Nama Lengkap
              </label>
              <input
                id="add-name"
                type="text"
                className={inputClass}
                placeholder="Contoh: Budi Santoso"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="add-username">
                Username (Opsional - dibuat otomatis jika kosong)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 select-none">
                  @
                </span>
                <input
                  id="add-username"
                  type="text"
                  className={`${inputClass} pl-7 font-mono text-xs`}
                  placeholder="username_pengguna"
                  value={createUsername}
                  onChange={(e) =>
                    setCreateUsername(
                      e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, ""),
                    )
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="add-email">
                Alamat Email
              </label>
              <input
                id="add-email"
                type="email"
                className={inputClass}
                placeholder="budi@acme.id"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="add-password">
                Password Sementara
              </label>
              <div className="relative">
                <input
                  id="add-password"
                  type={showCreatePassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  placeholder="Minimal 6 karakter"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Peran / Hak Akses</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateRole("user")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left transition ${
                    createRole === "user"
                      ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <UserIcon
                    size={16}
                    className={createRole === "user" ? "text-violet-600" : "text-zinc-400"}
                  />
                  <div>
                    <p className="text-xs font-semibold">User</p>
                    <p className="text-[10px] text-zinc-500">Anggota reguler</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateRole("superadmin")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left transition ${
                    createRole === "superadmin"
                      ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <ShieldCheck
                    size={16}
                    className={createRole === "superadmin" ? "text-violet-600" : "text-zinc-400"}
                  />
                  <div>
                    <p className="text-xs font-semibold">Superadmin</p>
                    <p className="text-[10px] text-zinc-500">Akses penuh sistem</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button type="button" onClick={() => setOpenCreate(false)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" disabled={submittingCreate}>
                {submittingCreate ? "Menambahkan..." : "Tambah Pengguna"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Edit User */}
      {editingUser && (
        <Modal title={`Edit User: ${editingUser.name}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="edit-name">
                Nama Lengkap
              </label>
              <input
                id="edit-name"
                type="text"
                className={inputClass}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="edit-username">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 select-none">
                  @
                </span>
                <input
                  id="edit-username"
                  type="text"
                  className={`${inputClass} pl-7 font-mono text-xs`}
                  placeholder="username_pengguna"
                  value={editUsername}
                  onChange={(e) =>
                    setEditUsername(
                      e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, ""),
                    )
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="edit-email">
                Alamat Email
              </label>
              <input
                id="edit-email"
                type="email"
                className={inputClass}
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="edit-password">
                Password Baru (Opsional)
              </label>
              <div className="relative">
                <input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Peran / Hak Akses</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditRole("user")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left transition ${
                    editRole === "user"
                      ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <UserIcon
                    size={16}
                    className={editRole === "user" ? "text-violet-600" : "text-zinc-400"}
                  />
                  <div>
                    <p className="text-xs font-semibold">User</p>
                    <p className="text-[10px] text-zinc-500">Anggota reguler</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEditRole("superadmin")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left transition ${
                    editRole === "superadmin"
                      ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <ShieldCheck
                    size={16}
                    className={editRole === "superadmin" ? "text-violet-600" : "text-zinc-400"}
                  />
                  <div>
                    <p className="text-xs font-semibold">Superadmin</p>
                    <p className="text-[10px] text-zinc-500">Akses penuh sistem</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button type="button" onClick={() => setEditingUser(null)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" disabled={submittingEdit}>
                {submittingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
