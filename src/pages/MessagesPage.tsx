import {
  ArrowLeft,
  Hash,
  MailPlus,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, cn, inputClass, Modal } from "../components/ui";
import { realtimeSocket } from "../services/echo";
import { toast } from "../services/notifications";
import { resolveChatDisplayName, useAppStore } from "../store";

export function MessagesPage() {
  const {
    currentUser,
    chats,
    tasks,
    addFriend,
    sendMessage,
    syncChats,
    markAsRead,
    addReceivedMessage,
  } = useAppStore();
  const [params] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(params.get("room"));
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [friendOpen, setFriendOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const active = chats.find((chat) => chat.id === activeId) ?? (activeId ? undefined : chats[0]);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // 1. Initial sync and periodic polling for real-time messages
  useEffect(() => {
    // Initial fetch
    syncChats();

    // Fast polling interval (every 2.5 seconds) while viewing Messages
    const interval = window.setInterval(() => {
      syncChats();
    }, 2500);

    // Immediate sync on tab switch or window focus
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncChats();
      }
    };
    const handleFocus = () => {
      syncChats();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncChats]);

  // 2. Real-time WebSocket listener if WebSocket/Reverb is running
  useEffect(() => {
    if (!active?.id) return;

    realtimeSocket.connect();
    const channelName = `chat.${active.id}`;
    const unsubscribe = realtimeSocket.subscribe(channelName, "message.sent", (data: any) => {
      addReceivedMessage(active.id, data);
      markAsRead(active.id);
    });

    return () => {
      unsubscribe();
    };
  }, [active?.id, addReceivedMessage, markAsRead]);

  // 3. Mark active room as read whenever viewed and has unread messages
  useEffect(() => {
    if (active && active.unread > 0) {
      markAsRead(active.id);
    }
  }, [active?.id, active?.unread, markAsRead]);

  // 4. Track scroll position to decide whether to auto-scroll on incoming message
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  };

  // Instant scroll on active room change
  useEffect(() => {
    if (!active?.id) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    isNearBottomRef.current = true;
  }, [active?.id]);

  // Smooth scroll when new message is added or received
  useEffect(() => {
    if (!active?.messages?.length) return;
    const lastMsg = active.messages[active.messages.length - 1];
    if (lastMsg?.mine || isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [active?.messages?.length]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncChats();
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };
  useEffect(() => {
    const room = params.get("room");
    if (room) setActiveId(room);
  }, [params]);
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter((chat) =>
      resolveChatDisplayName(chat, currentUser).toLowerCase().includes(q),
    );
  }, [chats, searchQuery, currentUser]);
  const suggestions = useMemo(() => {
    if (!active?.projectId || !message.includes("#")) return [];
    const fragment = message.slice(message.lastIndexOf("#") + 1).toLowerCase();
    return tasks
      .filter(
        (task) =>
          task.projectId === active.projectId &&
          (task.id.toLowerCase().includes(fragment) || task.title.toLowerCase().includes(fragment)),
      )
      .slice(0, 4);
  }, [active?.projectId, message, tasks]);
  const chooseTask = (taskId: string) =>
    setMessage((current) => `${current.slice(0, current.lastIndexOf("#"))}#${taskId} `);
  const submit = () => {
    if (active && message.trim()) {
      sendMessage(active.id, message.trim());
      setMessage("");
    }
  };
  const renderMessage = (text: string, projectId?: string) =>
    text.split(/(#TASK-\d+)/g).map((part, index) =>
      part.match(/^#TASK-\d+$/) && projectId ? (
        <button
          key={index}
          onClick={() => navigate(`/projects/${projectId}?taskId=${part.slice(1)}`)}
          className="mx-0.5 rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
        >
          {part}
        </button>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  return (
    <div className="-m-4 flex h-[calc(100dvh-8.25rem)] overflow-hidden sm:-m-6 sm:h-[calc(100dvh-8.25rem)] lg:h-[calc(100dvh-4rem)]">
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:flex md:w-80",
          activeId ? "hidden" : "flex",
        )}
      >
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Messages</h1>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                title="Pembaruan otomatis real-time aktif tanpa perlu refresh"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleManualSync}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                title="Sinkronkan pesan sekarang"
                aria-label="Sinkronkan pesan"
              >
                <RotateCw size={14} className={isSyncing ? "animate-spin text-violet-500" : ""} />
              </button>
              <button
                onClick={() => setFriendOpen(true)}
                className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                title="Tambah teman"
              >
                <MailPlus size={17} />
              </button>
            </div>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Cari percakapan"
            />
          </div>
        </div>
        <div className="scrollbar-none flex-1 overflow-y-auto p-2">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                {currentUser?.role === "superadmin" || currentUser?.is_superadmin ? (
                  <ShieldCheck size={22} />
                ) : (
                  <MessageSquare size={18} />
                )}
              </div>
              <p className="mt-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {currentUser?.role === "superadmin" || currentUser?.is_superadmin
                  ? "Privasi Chat Terjaga"
                  : "Belum ada percakapan"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                {currentUser?.role === "superadmin" || currentUser?.is_superadmin
                  ? "Sebagai Super Admin, percakapan langsung dan grup obrolan antar pengguna tidak ditampilkan untuk melindungi kerahasiaan & privasi tim."
                  : "Mulai percakapan dengan menambahkan rekan kerja via email."}
              </p>
              <button
                onClick={() => setFriendOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <MailPlus size={13} />
                Tambah teman
              </button>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              Tidak ada percakapan ditemukan.
            </div>
          ) : (
            (["direct", "group"] as const).map((type) => {
              const items = filteredChats.filter((chat) => chat.type === type);
              if (items.length === 0) return null;
              return (
                <div key={type} className="mb-4">
                  <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {type === "direct" ? "Direct messages" : "Project groups"}
                  </p>
                  {items.map((chat) => {
                    const chatName = resolveChatDisplayName(chat, currentUser);
                    return (
                      <button
                        key={chat.id}
                        onClick={() => setActiveId(chat.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg p-2.5 text-left",
                          active?.id === chat.id
                            ? "bg-zinc-100 dark:bg-zinc-900"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                        )}
                      >
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold dark:bg-zinc-800">
                          {chat.type === "group" ? (
                            <Users size={15} />
                          ) : (
                            chatName
                              .split(" ")
                              .map((word) => word[0])
                              .join("")
                              .slice(0, 2)
                          )}
                          {chat.online && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-950" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between">
                            <p className="truncate text-xs font-medium">{chatName}</p>
                            <span className="text-[9px] text-zinc-400">
                              {chat.messages.at(-1)?.time}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[10px] text-zinc-500">
                            {chat.messages.at(-1)?.text ?? "Mulai percakapan"}
                          </p>
                        </div>
                        {chat.unread > 0 && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </aside>
      <section
        className={cn(
          "min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950 md:flex",
          activeId ? "flex" : "hidden",
        )}
      >
        {active ? (
          <>
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-5">
              <button
                onClick={() => setActiveId(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 md:hidden"
                aria-label="Kembali ke daftar percakapan"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold dark:bg-zinc-900">
                {active.type === "group" ? (
                  <Users size={15} />
                ) : (
                  resolveChatDisplayName(active, currentUser).slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {resolveChatDisplayName(active, currentUser)}
                  </p>
                  <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 sm:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Real-time
                  </span>
                </div>
                <p className="truncate text-[10px] text-zinc-500">
                  {active.type === "group"
                    ? "Project group · ketik # untuk mention task"
                    : active.online
                      ? "Online"
                      : "Offline"}
                </p>
              </div>
              <button className="ml-auto text-zinc-400">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 sm:p-5"
            >
              <div className="mx-auto max-w-3xl space-y-4">
                {active.messages.map((item) => (
                  <div
                    key={item.id}
                    className={cn("flex", item.mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 sm:max-w-[80%]",
                        item.mine
                          ? "rounded-br-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                          : "rounded-bl-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
                      )}
                    >
                      <p>{renderMessage(item.text, active.projectId)}</p>
                      <p
                        className={cn(
                          "mt-1 text-right text-[9px]",
                          item.mine ? "text-zinc-400" : "text-zinc-400",
                        )}
                      >
                        {item.sender} · {item.time}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="shrink-0 border-t border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
              <div className="relative mx-auto max-w-3xl">
                {suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="border-b border-zinc-200 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-400 dark:border-zinc-800">
                      Mention task
                    </p>
                    {suggestions.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => chooseTask(task.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <Hash size={13} className="text-violet-500" />
                        <div>
                          <p className="text-xs font-medium">{task.id}</p>
                          <p className="text-[10px] text-zinc-500">{task.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <button className="hidden p-1.5 text-zinc-400 sm:block">
                    <Paperclip size={17} />
                  </button>
                  <textarea
                    rows={1}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    className="max-h-28 min-h-7 flex-1 resize-none bg-transparent py-1 text-xs outline-none"
                    placeholder={
                      active.type === "group"
                        ? "Tulis pesan atau mention #task..."
                        : "Tulis pesan..."
                    }
                  />
                  <button className="hidden p-1.5 text-zinc-400 sm:block">
                    <Smile size={17} />
                  </button>
                  <button
                    onClick={submit}
                    className="rounded-lg bg-violet-600 p-2 text-white transition hover:bg-violet-700 dark:bg-violet-500 dark:text-white dark:hover:bg-violet-400"
                    aria-label="Kirim pesan"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-500">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
              <MessageSquare size={28} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-zinc-800 dark:text-zinc-200">
              Belum ada percakapan yang dipilih
            </h2>
            <p className="mt-1.5 max-w-sm text-xs text-zinc-500">
              Pilih salah satu percakapan di bilah kiri, atau tambah rekan kerja untuk memulai
              percakapan baru.
            </p>
            <button
              onClick={() => setFriendOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
            >
              <MailPlus size={15} />
              Tambah teman via email
            </button>
          </div>
        )}
      </section>
      {friendOpen && (
        <Modal title="Tambah teman via email" onClose={() => setFriendOpen(false)}>
          <p className="mb-4 text-xs leading-5 text-zinc-500">
            Masukkan email rekan kerja. Percakapan direct baru akan langsung tersedia.
          </p>
          <input
            autoFocus
            type="email"
            className={inputClass}
            placeholder="nama@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setFriendOpen(false)}>Batal</Button>
            <Button
              variant="primary"
              disabled={!email.includes("@")}
              onClick={() => {
                addFriend(email);
                toast.success(`Percakapan dengan ${email} telah dibuat.`);
                setFriendOpen(false);
                setEmail("");
              }}
            >
              Tambah teman
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
