import { ArrowRight, Check, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Button, inputClass } from "../components/ui";
import { toast } from "../services/notifications";
import { useAppStore } from "../store";

type AuthMode = "login" | "register";

const benefits = [
  "Prioritas deadline otomatis",
  "Project, task, dan chat dalam satu tempat",
  "Reminder agenda H-3",
];

function AuthPage({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";
  const { currentUser, login, register, theme, toggleTheme } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (isRegister && name.trim().length < 2) {
      const msg = "Nama harus terdiri dari minimal 2 karakter.";
      setError(msg);
      toast.error(msg, "Validasi Gagal");
      return;
    }
    if (!email.includes("@")) {
      const msg = "Masukkan alamat email yang valid.";
      setError(msg);
      toast.error(msg, "Validasi Gagal");
      return;
    }
    if (password.length < 6) {
      const msg = "Password harus terdiri dari minimal 6 karakter.";
      setError(msg);
      toast.error(msg, "Validasi Gagal");
      return;
    }

    try {
      setLoading(true);
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
        toast.success(`Selamat datang di Fokusin, ${name.trim()}!`, "Pendaftaran Berhasil");
      } else {
        await login(email.trim(), password);
        toast.success("Berhasil masuk ke Fokusin.", "Masuk Berhasil");
      }
      navigate(isRegister ? "/" : destination, { replace: true });
    } catch (err: any) {
      const msg =
        err?.data?.errors?.email?.[0] ||
        err?.data?.errors?.password?.[0] ||
        err?.data?.errors?.name?.[0] ||
        err?.data?.message ||
        err?.message ||
        "Gagal autentikasi. Pastikan akun terdaftar di database dan password benar.";
      setError(msg);
      toast.error(msg, isRegister ? "Pendaftaran Gagal" : "Gagal Masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden border-r border-zinc-200 bg-zinc-50 p-10 dark:border-zinc-800 dark:bg-zinc-900/40 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
            F
          </div>
          <span className="text-base font-semibold">Fokusin</span>
        </div>
        <div className="my-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            Work management, simplified
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-5xl">
            Fokus pada pekerjaan yang benar-benar penting.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-zinc-500">
            Atur pekerjaan, deadline, agenda, dan komunikasi tim tanpa berpindah aplikasi.
          </p>
          <div className="mt-9 space-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900 dark:bg-violet-950">
                  <Check size={13} strokeWidth={2.5} />
                </span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          Fokusin Workspace · Kelola hari dengan lebih tenang.
        </p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="absolute left-5 top-5 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">
            F
          </div>
          <span className="text-sm font-semibold">Fokusin</span>
        </div>
        <button
          onClick={toggleTheme}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          aria-label="Ganti tema"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
              {isRegister ? "MULAI WORKSPACE BARU" : "SELAMAT DATANG KEMBALI"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {isRegister ? "Buat akun Fokusin" : "Masuk ke Fokusin"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {isRegister
                ? "Buat akun untuk mulai mengelola pekerjaan dan tim."
                : "Masukkan detail akun untuk melanjutkan ke workspace."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="mb-2 block text-xs font-medium" htmlFor="name">
                  Nama lengkap
                </label>
                <input
                  id="name"
                  autoComplete="name"
                  className={inputClass}
                  placeholder="Nama Anda"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-xs font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                placeholder="nama@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className={`${inputClass} pr-11`}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="mt-2 w-full" disabled={loading}>
              {loading
                ? isRegister
                  ? "Mendaftarkan..."
                  : "Memeriksa..."
                : isRegister
                  ? "Buat akun"
                  : "Masuk"}
              <ArrowRight size={15} />
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500">
            {isRegister ? "Sudah memiliki akun?" : "Belum memiliki akun?"}{" "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-semibold text-zinc-950 hover:text-violet-600 dark:text-white dark:hover:text-violet-400"
            >
              {isRegister ? "Masuk" : "Daftar sekarang"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  return <AuthPage mode="login" />;
}

export function RegisterPage() {
  return <AuthPage mode="register" />;
}
