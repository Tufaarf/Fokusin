import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button, Card, inputClass } from "../components/ui";
import { confirmDialog } from "../services/dialog";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";

export function ProfilePage() {
  const { currentUser, updateProfile, logout } = useAppStore();
  const navigate = useNavigate();

  // State Profile Info
  const [name, setName] = useState(currentUser?.name ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  // State Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const isSuper = currentUser?.role === "superadmin" || currentUser?.is_superadmin;

  const initials = (currentUser?.name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Nama lengkap harus memiliki minimal 2 karakter.", "Validasi Gagal");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Alamat email tidak valid.", "Validasi Gagal");
      return;
    }

    try {
      setSavingInfo(true);
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
      });
      toast.success("Informasi profil Anda berhasil diperbarui.", "Profil Tersimpan");
    } catch (err: any) {
      const msg =
        err?.data?.errors?.email?.[0] ||
        err?.data?.errors?.name?.[0] ||
        err?.data?.message ||
        err?.message ||
        "Gagal memperbarui profil. Silakan coba beberapa saat lagi.";
      toast.error(msg, "Gagal Menyimpan");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSavePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Password saat ini wajib diisi untuk mengubah password.", "Validasi Gagal");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru harus terdiri dari minimal 6 karakter.", "Validasi Gagal");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok dengan password baru.", "Validasi Gagal");
      return;
    }

    try {
      setSavingPassword(true);
      await updateProfile({
        name: name.trim() || currentUser?.name || "",
        email: email.trim() || currentUser?.email || "",
        current_password: currentPassword,
        password: newPassword,
      });
      toast.success("Password Anda berhasil diperbarui.", "Keamanan Diperbarui");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg =
        err?.data?.errors?.current_password?.[0] ||
        err?.data?.errors?.password?.[0] ||
        err?.data?.message ||
        err?.message ||
        "Gagal memperbarui password. Pastikan password saat ini benar.";
      toast.error(msg, "Gagal Mengubah Password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: "Keluar dari Akun",
      message: "Apakah Anda yakin ingin keluar dari sesi aplikasi Fokusin saat ini?",
      confirmText: "Keluar",
      cancelText: "Batal",
      variant: "warning",
    });
    if (confirmed) {
      await logout();
      toast.info("Anda telah berhasil keluar dari akun.");
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Pengaturan Profil</h1>
            {isSuper ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
                <ShieldCheck size={13} /> Superadmin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <UserIcon size={13} /> Pengguna
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Kelola nama lengkap, email, dan keamanan kata sandi akun Anda di Fokusin.
          </p>
        </div>

        <Button
          onClick={handleLogout}
          className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 sm:w-auto"
        >
          <LogOut size={15} /> Keluar Akun
        </Button>
      </div>

      {/* Profile Overview Banner */}
      <Card className="relative overflow-hidden p-6 sm:p-7">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Avatar Initials Badge (Tanpa Foto) */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-violet-200 bg-violet-50 text-2xl font-bold text-violet-700 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300 sm:h-24 sm:w-24 sm:text-3xl">
            {initials}
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-bold tracking-tight">{currentUser?.name}</h2>
              {isSuper && (
                <span className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Superadmin
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-zinc-500 sm:justify-start">
              <Mail size={14} className="text-zinc-400" />
              {currentUser?.email}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 sm:justify-start">
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-900">
                User ID:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  #{currentUser?.id || "local"}
                </span>
              </span>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-900">
                Status:{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ● Aktif
                </span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Form Grids: Profile Info & Security */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1: Data Diri */}
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
              <UserIcon size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Informasi Pribadi</h3>
              <p className="text-xs text-zinc-500">Perbarui nama lengkap dan kontak email akun.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor="profile-name">
                Nama Lengkap
              </label>
              <input
                id="profile-name"
                type="text"
                className={inputClass}
                placeholder="Nama lengkap Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor="profile-email">
                Alamat Email
              </label>
              <input
                id="profile-email"
                type="email"
                className={inputClass}
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Email digunakan untuk login dan notifikasi agenda tim.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Peran Akun (Role)</label>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {isSuper ? (
                  <ShieldCheck size={16} className="text-violet-600" />
                ) : (
                  <Shield size={16} />
                )}
                <span>
                  {isSuper
                    ? "Super Administrator (Hak Akses Penuh Sistem)"
                    : "Pengguna Reguler (Anggota Tim)"}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={savingInfo} className="w-full">
                {savingInfo ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Section 2: Keamanan & Password */}
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Keamanan & Password</h3>
              <p className="text-xs text-zinc-500">Ubah kata sandi untuk melindungi akun Anda.</p>
            </div>
          </div>

          <form onSubmit={handleSavePassword} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor="curr-pass">
                Password Saat Ini
              </label>
              <div className="relative">
                <input
                  id="curr-pass"
                  type={showCurrentPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  placeholder="Masukkan password saat ini"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor="new-pass">
                Password Baru
              </label>
              <div className="relative">
                <input
                  id="new-pass"
                  type={showNewPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium" htmlFor="confirm-pass">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <input
                  id="confirm-pass"
                  type={showConfirmPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  placeholder="Ketik ulang password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="secondary"
                disabled={savingPassword || !newPassword}
                className="w-full border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <KeyRound size={15} />
                {savingPassword ? "Memperbarui Password..." : "Perbarui Password"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
