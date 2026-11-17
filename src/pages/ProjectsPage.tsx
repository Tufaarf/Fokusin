import { ArrowUpRight, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button, Card, inputClass, Modal } from "../components/ui";
import { useAppStore } from "../store";

export function ProjectsPage() {
  const { projects, tasks, addProject, currentUser } = useAppStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState([""]);
  const submit = () => {
    if (!name.trim()) return;
    addProject(name.trim(), emails.filter(Boolean));
    setName("");
    setEmails([""]);
    setOpen(false);
  };
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            {(currentUser?.role === "superadmin" || currentUser?.is_superadmin) && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                🛡️ Superadmin: Semua Project Pengguna
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Kelola pekerjaan tim dari ide hingga selesai.
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <Plus size={15} /> Project baru
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const projectTasks = tasks.filter((task) => task.projectId === project.id);
          const done = projectTasks.filter((task) => task.status === "done").length;
          const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
          return (
            <Card key={project.id} className="group p-5">
              <div className="flex items-start justify-between">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                <Link
                  to={`/projects/${project.id}`}
                  className="rounded-md p-1 text-zinc-400 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <h2 className="mt-5 font-semibold">{project.name}</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {projectTasks.length} tasks · {done} selesai
              </p>
              <div className="mt-6 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-full bg-zinc-950 dark:bg-white"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                <span>{progress}% progress</span>
                <span className="flex items-center gap-1">
                  <Users size={12} /> {project.members.length}
                </span>
              </div>
              <Link
                to={`/projects/${project.id}`}
                className="mt-5 flex h-9 items-center justify-center rounded-lg border border-zinc-200 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Buka board
              </Link>
            </Card>
          );
        })}
      </div>
      {open && (
        <Modal title="Buat project baru" onClose={() => setOpen(false)}>
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium">Nama project</label>
              <input
                autoFocus
                className={inputClass}
                placeholder="Contoh: Product Launch"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium">Anggota via email</label>
                <button
                  onClick={() => setEmails((current) => [...current, ""])}
                  className="text-xs font-medium text-violet-600"
                >
                  + Tambah
                </button>
              </div>
              <div className="space-y-2">
                <div
                  className={`${inputClass} flex items-center bg-zinc-50 text-zinc-500 dark:bg-zinc-900`}
                >
                  you@acme.id <span className="ml-auto text-[10px]">You · Owner</span>
                </div>
                {emails.map((email, index) => (
                  <input
                    key={index}
                    className={inputClass}
                    type="email"
                    placeholder="anggota@company.com"
                    value={email}
                    onChange={(event) =>
                      setEmails((current) =>
                        current.map((item, i) => (i === index ? event.target.value : item)),
                      )
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={!name.trim()}
                onClick={submit}
                className="w-full sm:w-auto"
              >
                Buat project
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
