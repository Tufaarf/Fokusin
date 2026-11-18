import type { CalendarEvent, ChatRoom, Note, Project, Task } from "./types";

const isoAfter = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const initialProjects: Project[] = [
  {
    id: "orbit",
    name: "Orbit Mobile App",
    color: "#7c3aed",
    members: ["you@acme.id", "naya@acme.id", "rehan@acme.id"],
  },
  {
    id: "atlas",
    name: "Atlas Website",
    color: "#0284c7",
    members: ["you@acme.id", "alif@acme.id"],
  },
  {
    id: "growth",
    name: "Growth Experiments",
    color: "#d97706",
    members: ["you@acme.id", "sarah@acme.id"],
  },
];

export const initialTasks: Task[] = [
  {
    id: "TASK-142",
    projectId: "orbit",
    title: "Finalize onboarding flow",
    description:
      "Review the final onboarding screens and prepare the interaction notes for engineering.",
    status: "progress",
    priority: "High",
    dueDate: isoAfter(1),
    assignee: "Naya P.",
    tags: ["Design", "Mobile"],
  },
  {
    id: "TASK-145",
    projectId: "orbit",
    title: "Empty state illustrations",
    description: "Create a consistent family of empty states for the core mobile experience.",
    status: "todo",
    priority: "Medium",
    dueDate: isoAfter(4),
    assignee: "You",
    tags: ["Design"],
  },
  {
    id: "TASK-138",
    projectId: "orbit",
    title: "API contract review",
    description: "Align mobile endpoints with the latest product requirements.",
    status: "review",
    priority: "High",
    dueDate: isoAfter(2),
    assignee: "Rehan A.",
    tags: ["Backend"],
  },
  {
    id: "TASK-132",
    projectId: "orbit",
    title: "Design token migration",
    description: "Migrate all legacy colors and spacing values to semantic tokens.",
    status: "done",
    priority: "Medium",
    dueDate: isoAfter(-2),
    assignee: "You",
    tags: ["System"],
  },
  {
    id: "TASK-208",
    projectId: "atlas",
    title: "Pricing page content",
    description: "Refine pricing copy and validate plan comparison.",
    status: "todo",
    priority: "High",
    dueDate: isoAfter(3),
    assignee: "Alif R.",
    tags: ["Content"],
  },
  {
    id: "TASK-211",
    projectId: "atlas",
    title: "Core Web Vitals audit",
    description: "Profile production pages and document priority fixes.",
    status: "progress",
    priority: "Medium",
    dueDate: isoAfter(6),
    assignee: "You",
    tags: ["Frontend"],
  },
  {
    id: "TASK-305",
    projectId: "growth",
    title: "Referral hypothesis",
    description: "Draft the referral experiment plan and success criteria.",
    status: "review",
    priority: "Low",
    dueDate: isoAfter(5),
    assignee: "Sarah K.",
    tags: ["Research"],
  },
];

export const initialEvents: CalendarEvent[] = [
  {
    id: "EV-1",
    title: "Orbit design critique",
    date: isoAfter(1),
    time: "09:30",
    type: "Meeting",
    projectId: "orbit",
  },
  {
    id: "EV-2",
    title: "API review deadline",
    date: isoAfter(2),
    time: "17:00",
    type: "Deadline",
    projectId: "orbit",
  },
  { id: "EV-3", title: "Weekly product sync", date: isoAfter(3), time: "10:00", type: "Meeting" },
  {
    id: "EV-4",
    title: "Atlas content handoff",
    date: isoAfter(5),
    time: "14:00",
    type: "Event",
    projectId: "atlas",
  },
  {
    id: "EV-5",
    title: "Growth retrospective",
    date: isoAfter(7),
    time: "15:30",
    type: "Meeting",
    projectId: "growth",
  },
];

export const initialChats: ChatRoom[] = [
  {
    id: "chat-naya",
    name: "Naya Putri",
    type: "direct",
    unread: 2,
    online: true,
    pinnedMessage: {
      id: "m1",
      sender: "Naya",
      text: "Aku sudah update flow onboarding. Bisa cek sore ini?",
      time: "10:24",
      isPinned: true,
    },
    messages: [
      {
        id: "m1",
        sender: "Naya",
        text: "Aku sudah update flow onboarding. Bisa cek sore ini?",
        time: "10:24",
        status: "read",
        isPinned: true,
        reactions: [
          { emoji: "👍", count: 1, users: ["You"] },
          { emoji: "🔥", count: 1, users: ["Naya Putri"] },
        ],
      },
      {
        id: "m2",
        sender: "Naya",
        text: "Ada sedikit perubahan di step permissions.",
        time: "10:26",
        status: "read",
        isForwarded: true,
      },
    ],
  },
  {
    id: "chat-orbit",
    name: "Orbit Mobile App",
    type: "group",
    projectId: "orbit",
    unread: 4,
    messages: [
      {
        id: "m3",
        sender: "Rehan",
        text: "API contract untuk #TASK-138 sudah siap direview.",
        time: "09:42",
        status: "read",
        isStarred: true,
        reactions: [{ emoji: "🚀", count: 2, users: ["Naya", "You"] }],
      },
      {
        id: "m4",
        sender: "You",
        text: "Sip, aku cek setelah standup.",
        time: "09:45",
        mine: true,
        status: "read",
        isEdited: true,
        replyTo: {
          id: "m3",
          sender: "Rehan",
          text: "API contract untuk #TASK-138 sudah siap direview.",
        },
      },
      {
        id: "m5",
        sender: "Naya",
        text: "Tolong sekalian cek dependency ke #TASK-142 ya.",
        time: "10:02",
        status: "read",
      },
    ],
  },
  {
    id: "chat-alif",
    name: "Alif Rahman",
    type: "direct",
    unread: 0,
    online: false,
    messages: [
      {
        id: "m6",
        sender: "You",
        text: "Pricing page sudah aku kasih catatan.",
        time: "Kemarin",
        mine: true,
        status: "read",
      },
    ],
  },
  {
    id: "chat-atlas",
    name: "Atlas Website",
    type: "group",
    projectId: "atlas",
    unread: 1,
    messages: [
      {
        id: "m7",
        sender: "Alif",
        text: "Copy untuk #TASK-208 sudah masuk versi final.",
        time: "08:15",
        status: "read",
      },
    ],
  },
];

export const initialNotes: Note[] = [
  {
    id: "1",
    title: "💡 Ide Fitur Baru & Roadmap Q4",
    color: "amber",
    isPinned: true,
    tags: ["Roadmap", "Ide", "Fokusin"],
    content:
      '<h2>Roadmap Fitur Prioritas Fokusin</h2><p>Berikut adalah beberapa ide utama yang perlu dieksekusi bersama tim untuk meningkatkan produktivitas:</p><ul><li><strong>WYSIWYG Rich Notes:</strong> Menyimpan dokumen dan catatan berformat langsung di aplikasi.</li><li><strong>Task Reminders & Push:</strong> Integrasi notifikasi H-3 dan H-1 deadline.</li><li><strong>Dark Mode Polishing:</strong> Memastikan kontras elemen warna kartu nyaman di mata.</li></ul><p>Tugas aktif yang berhubungan dengan roadmap ini: <a href="#task-TASK-142" class="task-mention-chip">@TASK-142 (Finalize onboarding flow)</a> dan <a href="#task-TASK-138" class="task-mention-chip">@TASK-138 (API contract review)</a>.</p><p>Referensi desain dan dokumentasi UI dapat dilihat di tautan: <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer">https://tailwindcss.com</a> dan <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">https://vite.dev</a>.</p><blockquote><p>"Fokus pada hal penting, selesaikan satu per satu tanpa distraksi."</p></blockquote>',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "📝 Catatan Rapat Sprint Planning",
    color: "violet",
    isPinned: true,
    tags: ["Meeting", "Sprint"],
    content:
      '<h3>Sprint Planning #14</h3><p><strong>Tanggal:</strong> 17 November 2026</p><p><strong>Peserta:</strong> Tim Fokusin (Daffa, Naya, Alif, Sarah)</p><h4>Poin Pembahasan:</h4><ol><li>Review performa database query di Task Controller dan optimasi eager loading.</li><li>Implementasi modul Catatan (Notes) lengkap dengan rich text editor WYSIWYG, link web, dan task mention.</li><li>Integrasi live chat WebSocket dengan Laravel Echo & Reverb.</li></ol><p><em>Action item:</em> Tindak lanjuti task <a href="#task-TASK-208" class="task-mention-chip">@TASK-208 (Pricing page content)</a> dan pantau <a href="#task-TASK-211" class="task-mention-chip">@TASK-211 (Core Web Vitals audit)</a>.</p>',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "3",
    title: "📚 Snippet & Dokumentasi Arsitektur",
    color: "blue",
    isPinned: false,
    tags: ["Dokumentasi", "Dev"],
    content:
      "<h3>Arsitektur Fokusin Workspace</h3><p>Aplikasi ini dibangun dengan arsitektur decoupled modern:</p><ul><li><strong>Frontend:</strong> React 19 + Vite 8 + Tailwind CSS v4 + TipTap WYSIWYG + Zustand State</li><li><strong>Backend:</strong> Laravel 12 API + Sanctum Token Auth + MySQL</li><li><strong>Realtime:</strong> Laravel Reverb + Laravel Echo</li></ul><p>Perintah menjalankan server lokal:</p><pre><code>php artisan serve --host=0.0.0.0 --port=8000\npnpm dev</code></pre>",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "4",
    title: "✅ Checklist Peluncuran Modul Catatan",
    color: "emerald",
    isPinned: false,
    tags: ["Checklist", "Release"],
    content:
      "<h3>Daftar Verifikasi Fitur Notes</h3><p>Pastikan item-item berikut telah teruji sebelum rilis ke tim:</p><ul><li>Menu Notes muncul di navigasi desktop (Sidebar) dan mobile (Bottom Nav).</li><li>Editor WYSIWYG mendukung Bold, Italic, Underline, Heading 1-3, List, dan Quote.</li><li>Fitur Pin Catatan berfungsi dan menempatkan catatan di bagian atas.</li><li>Pencarian catatan berdasarkan judul atau teks isi responsif secara realtime.</li><li>Penyimpanan otomatis (Autosave) dan tombol simpan manual bekerja baik.</li></ul>",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];
