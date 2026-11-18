import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerUpRight,
  Hash,
  Info,
  MailPlus,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  Reply,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Square,
  Star,
  StarOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, cn, inputClass, Modal } from "../components/ui";
import { realtimeSocket } from "../services/echo";
import { toast } from "../services/notifications";
import { resolveChatDisplayName, useAppStore } from "../store";
import type { ChatMessage, ReplyPreview } from "../types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const EMOJI_PALETTE = [
  "😊",
  "😂",
  "🤣",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "🥳",
  "🤫",
  "😴",
  "👍",
  "👎",
  "❤️",
  "🔥",
  "🎉",
  "🚀",
  "💡",
  "✨",
  "👏",
  "🙏",
  "💯",
  "🤝",
  "📅",
  "✅",
  "📌",
  "⚠️",
  "💬",
  "☕",
  "💪",
  "🎯",
  "📦",
  "⭐",
];

export function MessagesPage() {
  const {
    currentUser,
    chats,
    tasks,
    addFriend,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePinMessage,
    toggleStarMessage,
    forwardMessage,
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

  // Advanced WhatsApp-like states
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [selectedForwardRooms, setSelectedForwardRooms] = useState<string[]>([]);
  const [forwardSearch, setForwardSearch] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);

  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState<ChatMessage | null>(null);

  const [starredModalOpen, setStarredModalOpen] = useState(false);
  const [roomSearchOpen, setRoomSearchOpen] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [roomMenuOpen, setRoomMenuOpen] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Audio / voice note recording simulator
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    type: "image" | "file";
    url: string;
    size?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = chats.find((chat) => chat.id === activeId) ?? (activeId ? undefined : chats[0]);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // 1. Initial sync and periodic polling for real-time messages
  useEffect(() => {
    syncChats();
    const interval = window.setInterval(() => {
      syncChats();
    }, 2500);

    const handleVisibilityChange = () => {
      if (!document.hidden) syncChats();
    };
    const handleFocus = () => syncChats();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncChats]);

  // 2. Real-time WebSocket listener
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
    setReplyingTo(null);
    setEditingMessage(null);
    setPendingAttachment(null);
    setRoomSearchOpen(false);
    setRoomSearchQuery("");
  }, [active?.id]);

  // Smooth scroll when new message is added or received
  useEffect(() => {
    if (!active?.messages?.length) return;
    const lastMsg = active.messages[active.messages.length - 1];
    if (lastMsg?.mine || isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [active?.messages?.length]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-chat-action-menu]") && !target.closest("[data-message-bubble]")) {
        setActiveActionId(null);
      }
      if (!target.closest("[data-emoji-picker]") && !target.closest("[data-emoji-btn]")) {
        setEmojiPickerOpen(false);
      }
      if (!target.closest("[data-room-menu]") && !target.closest("[data-room-menu-btn]")) {
        setRoomMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Long press (Mobile) & Right-click (PC) handlers for WhatsApp message options
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressActiveRef = useRef(false);

  const handleTouchStart = (item: ChatMessage, e: React.TouchEvent) => {
    if (item.isDeleted) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActiveRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // 420ms for comfortable and intentional long-press
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressActiveRef.current = true;
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch {}
      setActiveActionId(item.id);
      longPressTimerRef.current = null;
    }, 420);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // Cancel long-press if user moves or scrolls finger more than 8px
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressActiveRef.current) {
      // Prevent synthetic click from immediately dismissing the menu
      e.preventDefault();
      setTimeout(() => {
        isLongPressActiveRef.current = false;
      }, 150);
    }
    touchStartPosRef.current = null;
  };

  const handleContextMenu = (item: ChatMessage, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item.isDeleted) {
      setActiveActionId(item.id);
    }
  };

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

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

  // Jump to target message and briefly flash highlight
  const jumpToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(messageId);
      setTimeout(() => setHighlightedMsgId(null), 2200);
    } else {
      toast.info("Pesan berada di riwayat sebelumnya.");
    }
  };

  // Submit message (Send or Edit Save)
  const submit = () => {
    if (!active) return;

    if (editingMessage) {
      if (!message.trim()) return;
      editMessage(active.id, editingMessage.id, message.trim());
      toast.success("Pesan berhasil diedit");
      setEditingMessage(null);
      setMessage("");
      return;
    }

    if (message.trim() || pendingAttachment) {
      const textToSend = message.trim();
      const replyData: ReplyPreview | null = replyingTo
        ? {
            id: replyingTo.id,
            sender: replyingTo.sender,
            text: replyingTo.text.slice(0, 100),
          }
        : null;

      sendMessage(active.id, textToSend, replyData, false, pendingAttachment);
      setMessage("");
      setReplyingTo(null);
      setPendingAttachment(null);
      setEmojiPickerOpen(false);
    }
  };

  // Start voice recording simulator
  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleSendVoiceNote = () => {
    if (!active) return;
    const durationStr = `${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, "0")}`;
    sendMessage(
      active.id,
      `🎤 Pesan suara (${durationStr})`,
      replyingTo
        ? { id: replyingTo.id, sender: replyingTo.sender, text: replyingTo.text.slice(0, 80) }
        : null,
      false,
      {
        name: `Audio-${Date.now()}.m4a`,
        type: "audio",
        url: "#",
        size: `${Math.max(12, recordingSeconds * 8)} KB`,
      },
    );
    setIsRecording(false);
    setRecordingSeconds(0);
    setReplyingTo(null);
    toast.success("Pesan suara terkirim");
  };

  // Handle file attachment selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith("image/");
    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    const previewUrl = URL.createObjectURL(file);

    setPendingAttachment({
      name: file.name,
      type: isImg ? "image" : "file",
      url: previewUrl,
      size: sizeStr,
    });
    e.target.value = "";
  };

  // Start edit mode
  const handleStartEdit = (item: ChatMessage) => {
    if (item.isDeleted) return;
    setReplyingTo(null);
    setEditingMessage(item);
    setMessage(item.text);
    setActiveActionId(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage("");
  };

  // Prompt delete modal
  const handlePromptDelete = (item: ChatMessage) => {
    setDeletingMessage(item);
    setDeleteModalOpen(true);
    setActiveActionId(null);
  };

  const handleConfirmDelete = async (forEveryone: boolean) => {
    if (!active || !deletingMessage) return;
    await deleteMessage(active.id, deletingMessage.id, forEveryone);
    toast.success(forEveryone ? "Pesan dihapus untuk semua orang" : "Pesan dihapus untuk Anda");
    setDeleteModalOpen(false);
    setDeletingMessage(null);
  };

  // Forward message flow
  const handlePromptForward = (item: ChatMessage) => {
    setForwardingMessage(item);
    setSelectedForwardRooms([active?.id || ""]);
    setForwardModalOpen(true);
    setActiveActionId(null);
  };

  const handleConfirmForward = async () => {
    if (!forwardingMessage || selectedForwardRooms.length === 0) return;
    await forwardMessage(selectedForwardRooms, forwardingMessage.text);
    toast.success(`Pesan berhasil diteruskan ke ${selectedForwardRooms.length} percakapan`);
    setForwardModalOpen(false);
    setForwardingMessage(null);
    setSelectedForwardRooms([]);
  };

  // Star message toggle
  const handleToggleStar = (item: ChatMessage) => {
    if (!active) return;
    toggleStarMessage(active.id, item.id);
    toast.success(item.isStarred ? "Bintang pesan dihapus" : "Pesan dibintangi ⭐");
    setActiveActionId(null);
  };

  // Pin message toggle
  const handleTogglePin = (item: ChatMessage) => {
    if (!active) return;
    togglePinMessage(active.id, item.id);
    toast.success(item.isPinned ? "Sematan pesan dilepas" : "Pesan disematkan ke atas 📌");
    setActiveActionId(null);
  };

  // Copy message text
  const handleCopyText = (item: ChatMessage) => {
    navigator.clipboard.writeText(item.text);
    toast.success("Pesan disalin ke clipboard");
    setActiveActionId(null);
  };

  // Quick reaction trigger
  const handleReaction = (item: ChatMessage, emoji: string) => {
    if (!active || item.isDeleted) return;
    toggleReaction(active.id, item.id, emoji);
    setActiveActionId(null);
  };

  // Search in current room matches
  const roomSearchMatches = useMemo(() => {
    if (!roomSearchQuery.trim() || !active) return [];
    const q = roomSearchQuery.toLowerCase();
    return active.messages
      .filter((m) => !m.isDeleted && m.text.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [active, roomSearchQuery]);

  const starredMessages = useMemo(() => {
    if (!active) return [];
    return active.messages.filter((m) => m.isStarred && !m.isDeleted);
  }, [active]);

  // Render text with task mentions #TASK-XX
  const renderMessageText = (text: string, projectId?: string) => {
    return text.split(/(#TASK-\d+)/g).map((part, index) =>
      part.match(/^#TASK-\d+$/) && projectId ? (
        <button
          key={index}
          onClick={() => navigate(`/projects/${projectId}?taskId=${part.slice(1)}`)}
          className="mx-0.5 inline-flex items-center rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
        >
          {part}
        </button>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  };

  const pinnedMessage = active?.pinnedMessage || active?.messages.find((m) => m.isPinned);

  return (
    <div className="-m-4 flex h-[calc(100dvh-8.25rem)] overflow-hidden sm:-m-6 sm:h-[calc(100dvh-8.25rem)] lg:h-[calc(100dvh-4rem)]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* LEFT SIDEBAR: Conversations List */}
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
                    const lastMessage = chat.messages.at(-1);
                    return (
                      <button
                        key={chat.id}
                        onClick={() => setActiveId(chat.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition",
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
                            <span className="text-[9px] text-zinc-400">{lastMessage?.time}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            {lastMessage?.mine && (
                              <CheckCheck
                                size={12}
                                className={cn(
                                  "shrink-0",
                                  lastMessage.status === "read"
                                    ? "text-sky-500"
                                    : "text-zinc-400",
                                )}
                              />
                            )}
                            <p className="truncate text-[10px] text-zinc-500">
                              {lastMessage?.isDeleted ? (
                                <span className="italic text-zinc-400">
                                  Pesan ini telah dihapus
                                </span>
                              ) : (
                                lastMessage?.text ?? "Mulai percakapan"
                              )}
                            </p>
                          </div>
                        </div>
                        {chat.unread > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                            {chat.unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT SIDEBAR: Chat Room View */}
      <section
        className={cn(
          "relative min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950 md:flex",
          activeId ? "flex" : "hidden",
        )}
      >
        {active ? (
          <>
            {/* CHAT HEADER */}
            <div className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-5">
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
                    Online
                  </span>
                </div>
                <p className="truncate text-[10px] text-zinc-500">
                  {active.type === "group"
                    ? "Project group · ketik # untuk mention task"
                    : active.online
                      ? "Online · WhatsApp sync"
                      : "Offline"}
                </p>
              </div>

              {/* Header Right Actions */}
              <div className="ml-auto flex items-center gap-1">
                {/* Search in chat button */}
                <button
                  onClick={() => setRoomSearchOpen((v) => !v)}
                  className={cn(
                    "rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-900",
                    roomSearchOpen && "bg-zinc-100 text-violet-600 dark:bg-zinc-900",
                  )}
                  title="Cari dalam pesan"
                >
                  <Search size={16} />
                </button>

                {/* More options menu */}
                <div className="relative" data-room-menu>
                  <button
                    data-room-menu-btn
                    onClick={() => setRoomMenuOpen((v) => !v)}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    title="Menu opsi"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {roomMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                      <button
                        onClick={() => {
                          setStarredModalOpen(true);
                          setRoomMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Star size={14} className="text-amber-500" />
                        Pesan Berbintang ({starredMessages.length})
                      </button>
                      <button
                        onClick={() => {
                          setRoomSearchOpen(true);
                          setRoomMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Search size={14} />
                        Cari Pesan
                      </button>
                      <button
                        onClick={() => {
                          syncChats();
                          setRoomMenuOpen(false);
                          toast.success("Pesan disinkronkan");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <RotateCw size={14} />
                        Segarkan Percakapan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* IN-CHAT SEARCH BAR (WhatsApp style) */}
            {roomSearchOpen && (
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-100/90 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/90">
                <Search size={14} className="text-zinc-400" />
                <input
                  autoFocus
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  placeholder="Cari kata atau kalimat dalam chat ini..."
                  className="flex-1 bg-transparent text-xs outline-none"
                />
                {roomSearchQuery && (
                  <span className="text-[10px] font-medium text-zinc-500">
                    {roomSearchMatches.length} pesan cocok
                  </span>
                )}
                <button
                  onClick={() => {
                    setRoomSearchOpen(false);
                    setRoomSearchQuery("");
                  }}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* PINNED MESSAGE BANNER (WhatsApp style) */}
            {pinnedMessage && (
              <div
                onClick={() => jumpToMessage(pinnedMessage.id)}
                className="group flex cursor-pointer items-center justify-between border-b border-violet-100 bg-violet-50/70 px-4 py-2 transition hover:bg-violet-100/80 dark:border-violet-950 dark:bg-violet-950/40 dark:hover:bg-violet-950/70"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white dark:bg-violet-500">
                    <Pin size={11} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        Pesan Disematkan
                      </p>
                      <span className="text-[9px] text-zinc-400">· {pinnedMessage.sender}</span>
                    </div>
                    <p className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                      {pinnedMessage.text}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-violet-600 opacity-0 group-hover:opacity-100 dark:text-violet-400">
                    Lihat
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinMessage(active.id, pinnedMessage.id);
                      toast.success("Sematan pesan dilepas");
                    }}
                    className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    title="Lepas sematan"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* MESSAGES LIST AREA */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 sm:p-5"
            >
              <div className="mx-auto max-w-3xl space-y-3">
                {active.messages.map((item, index) => {
                  const isDeleted = Boolean(item.isDeleted);
                  const isHighlighted = highlightedMsgId === item.id;
                  const isMatchingSearch =
                    roomSearchQuery.trim() &&
                    !isDeleted &&
                    item.text.toLowerCase().includes(roomSearchQuery.toLowerCase());
                  const isNearBottomList =
                    active.messages.length - index <= 3 && active.messages.length > 2;

                  return (
                    <div
                      key={item.id}
                      id={`msg-${item.id}`}
                      className={cn(
                        "group relative flex transition-all duration-300",
                        item.mine ? "justify-end" : "justify-start",
                        isHighlighted && "scale-[1.01]",
                      )}
                    >
                      <div
                        data-message-bubble
                        onContextMenu={(e) => handleContextMenu(item, e)}
                        onTouchStart={(e) => handleTouchStart(item, e)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        className={cn(
                          "relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 shadow-xs transition sm:max-w-[80%] select-none touch-manipulation cursor-pointer sm:cursor-default",
                          item.mine
                            ? "rounded-br-sm bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                            : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
                          isHighlighted &&
                            "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-zinc-950",
                          activeActionId === item.id &&
                            "ring-2 ring-violet-500/80 ring-offset-1 dark:ring-offset-zinc-950",
                          isMatchingSearch && "bg-amber-100/90 dark:bg-amber-950/40",
                        )}
                      >
                        {/* WhatsApp Quick Action Button (Chevron Dropdown trigger) */}
                        {!isDeleted && (
                          <div
                            className={cn(
                              "absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100",
                              activeActionId === item.id && "opacity-100",
                            )}
                            data-chat-action-menu
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionId((curr) => (curr === item.id ? null : item.id));
                              }}
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full transition shadow-xs",
                                item.mine
                                  ? "bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 dark:bg-zinc-200/90 dark:text-zinc-800 dark:hover:bg-zinc-300"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
                              )}
                              title="Pilihan pesan (Klik kanan / Tekan lama)"
                            >
                              <ChevronDown size={13} />
                            </button>

                            {/* Dropdown Menu */}
                            {activeActionId === item.id && (
                              <div
                                className={cn(
                                  "absolute z-30 w-44 rounded-xl border border-zinc-200 bg-white p-1 text-zinc-800 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100",
                                  item.mine ? "right-0" : "left-0",
                                  isNearBottomList ? "bottom-full mb-1" : "top-full mt-1",
                                )}
                              >
                                {/* Quick reaction strip */}
                                <div className="mb-1 flex items-center justify-around border-b border-zinc-100 pb-1.5 pt-0.5 dark:border-zinc-800">
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReaction(item, emoji)}
                                      className="rounded p-1 text-sm hover:scale-125 hover:bg-zinc-100 transition dark:hover:bg-zinc-800"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() => {
                                    setReplyingTo(item);
                                    setEditingMessage(null);
                                    setActiveActionId(null);
                                    textareaRef.current?.focus();
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  <Reply size={13} className="text-violet-500" />
                                  Balas
                                </button>

                                <button
                                  onClick={() => handlePromptForward(item)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  <CornerUpRight size={13} className="text-blue-500" />
                                  Teruskan
                                </button>

                                <button
                                  onClick={() => handleCopyText(item)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  <Copy size={13} className="text-emerald-500" />
                                  Salin Teks
                                </button>

                                <button
                                  onClick={() => handleToggleStar(item)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  <Star
                                    size={13}
                                    className={cn(
                                      item.isStarred ? "fill-amber-400 text-amber-500" : "text-amber-500",
                                    )}
                                  />
                                  {item.isStarred ? "Hapus Bintang" : "Bintang"}
                                </button>

                                <button
                                  onClick={() => handleTogglePin(item)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  <Pin size={13} className="text-rose-500" />
                                  {item.isPinned ? "Lepas Sematan" : "Sematkan"}
                                </button>

                                {item.mine && (
                                  <button
                                    onClick={() => handleStartEdit(item)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  >
                                    <Pencil size={13} className="text-amber-500" />
                                    Edit Pesan
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setInfoMessage(item);
                                    setInfoModalOpen(true);
                                    setActiveActionId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  <Info size={13} className="text-zinc-400" />
                                  Info Pesan
                                </button>

                                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

                                <button
                                  onClick={() => handlePromptDelete(item)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 size={13} />
                                  Hapus Pesan
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Forwarded Header (WhatsApp style) */}
                        {item.isForwarded && (
                          <div className="mb-1 flex items-center gap-1 text-[10px] italic text-zinc-400 dark:text-zinc-500">
                            <CornerUpRight size={11} />
                            <span>Diteruskan</span>
                          </div>
                        )}

                        {/* Quoted Reply Card (WhatsApp style) */}
                        {item.replyTo && (
                          <div
                            onClick={() => jumpToMessage(item.replyTo!.id)}
                            className={cn(
                              "mb-2 cursor-pointer rounded-lg border-l-4 px-2.5 py-1.5 transition text-[11px]",
                              item.mine
                                ? "border-violet-400 bg-white/10 text-white/90 hover:bg-white/15 dark:border-violet-500 dark:bg-black/10 dark:text-zinc-900"
                                : "border-violet-500 bg-violet-50/80 text-zinc-800 hover:bg-violet-100/70 dark:border-violet-400 dark:bg-zinc-800 dark:text-zinc-200",
                            )}
                          >
                            <p className="font-semibold text-violet-400 dark:text-violet-500">
                              {item.replyTo.sender}
                            </p>
                            <p className="truncate opacity-80">{item.replyTo.text}</p>
                          </div>
                        )}

                        {/* Attachment Media if present */}
                        {item.attachment && (
                          <div className="mb-2 overflow-hidden rounded-lg">
                            {item.attachment.type === "image" ? (
                              <img
                                src={item.attachment.url}
                                alt={item.attachment.name}
                                className="max-h-56 w-full rounded-lg object-cover"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg p-2 text-xs",
                                  item.mine
                                    ? "bg-white/15 text-white dark:bg-black/10 dark:text-zinc-900"
                                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
                                )}
                              >
                                <Paperclip size={15} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{item.attachment.name}</p>
                                  {item.attachment.size && (
                                    <p className="text-[10px] opacity-70">
                                      {item.attachment.size}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Text Content */}
                        {isDeleted ? (
                          <p className="flex items-center gap-1.5 italic text-zinc-400 dark:text-zinc-500">
                            <Ban size={13} className="shrink-0" />
                            <span>Pesan ini telah dihapus</span>
                          </p>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">
                            {renderMessageText(item.text, active.projectId)}
                          </p>
                        )}

                        {/* Timestamp, Edited, Starred, & Status Ticks */}
                        <div
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1.5 text-[9px]",
                            item.mine
                              ? "text-zinc-400 dark:text-zinc-500"
                              : "text-zinc-400 dark:text-zinc-500",
                          )}
                        >
                          {item.isStarred && (
                            <Star size={10} className="fill-amber-400 text-amber-500" />
                          )}
                          {item.isPinned && <Pin size={10} className="text-violet-400" />}
                          {item.isEdited && <span className="italic">(diedit)</span>}
                          <span>
                            {item.sender} · {item.time}
                          </span>
                          {item.mine && (
                            <span title={item.status === "read" ? "Dibaca" : "Terkirim"}>
                              <CheckCheck
                                size={12}
                                className={cn(
                                  item.status === "read" ? "text-sky-400" : "text-zinc-400",
                                )}
                              />
                            </span>
                          )}
                        </div>

                        {/* Reactions Pills (WhatsApp style) */}
                        {item.reactions && item.reactions.length > 0 && (
                          <div
                            className={cn(
                              "mt-1.5 flex flex-wrap gap-1",
                              item.mine ? "justify-end" : "justify-start",
                            )}
                          >
                            {item.reactions.map((r, i) => {
                              const hasReacted = r.users.includes(currentUser?.name || "You");
                              return (
                                <button
                                  key={i}
                                  onClick={() => handleReaction(item, r.emoji)}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium shadow-xs transition hover:scale-105",
                                    hasReacted
                                      ? "border border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-200"
                                      : "border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                                  )}
                                  title={`Direaksikan oleh ${r.users.join(", ")}`}
                                >
                                  <span>{r.emoji}</span>
                                  <span>{r.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* CHAT INPUT AREA */}
            <div className="shrink-0 border-t border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
              <div className="relative mx-auto max-w-3xl">
                {/* 1. Reply Banner */}
                {replyingTo && (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50/80 p-2.5 dark:border-violet-900/60 dark:bg-violet-950/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <Reply size={14} className="text-violet-600 dark:text-violet-400" />
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-violet-700 dark:text-violet-300">
                          Membalas ke {replyingTo.sender}
                        </p>
                        <p className="truncate text-zinc-600 dark:text-zinc-400">
                          {replyingTo.text}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* 2. Edit Banner */}
                {editingMessage && (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <Pencil size={14} className="text-amber-600 dark:text-amber-400" />
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-amber-700 dark:text-amber-300">
                          Mengedit pesan
                        </p>
                        <p className="truncate text-zinc-600 dark:text-zinc-400">
                          {editingMessage.text}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCancelEdit}
                      className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* 3. Attachment Preview */}
                {pendingAttachment && (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                      <Paperclip size={14} className="text-violet-500" />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {pendingAttachment.name} ({pendingAttachment.size})
                      </span>
                    </div>
                    <button
                      onClick={() => setPendingAttachment(null)}
                      className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* 4. Task Mention Suggestions */}
                {suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
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

                {/* 5. Emoji Picker Popover */}
                {emojiPickerOpen && (
                  <div
                    data-emoji-picker
                    className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="mb-2 flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Pilih Emoji
                      </p>
                      <button
                        onClick={() => setEmojiPickerOpen(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_PALETTE.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setMessage((prev) => prev + emoji);
                            textareaRef.current?.focus();
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded text-base hover:scale-125 hover:bg-zinc-100 transition dark:hover:bg-zinc-800"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Voice Recording Mode OR Text Input Bar */}
                {isRecording ? (
                  <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50/80 p-2.5 dark:border-red-900/60 dark:bg-red-950/40">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-600" />
                      <span className="text-xs font-semibold">
                        Merekam suara... {Math.floor(recordingSeconds / 60)}:
                        {(recordingSeconds % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={handleCancelRecording}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleSendVoiceNote}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700"
                      >
                        <Send size={13} />
                        Kirim Audio
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    {/* Attachment Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      title="Lampirkan foto atau dokumen"
                    >
                      <Paperclip size={17} />
                    </button>

                    {/* Emoji Button */}
                    <button
                      data-emoji-btn
                      onClick={() => setEmojiPickerOpen((v) => !v)}
                      className={cn(
                        "p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                        emojiPickerOpen && "text-violet-600 dark:text-violet-400",
                      )}
                      title="Emoji"
                    >
                      <Smile size={17} />
                    </button>

                    {/* Textarea */}
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          submit();
                        }
                        if (event.key === "Escape") {
                          if (editingMessage) handleCancelEdit();
                          if (replyingTo) setReplyingTo(null);
                        }
                      }}
                      className="max-h-28 min-h-7 flex-1 resize-none bg-transparent py-1 text-xs outline-none"
                      placeholder={
                        editingMessage
                          ? "Perbarui teks pesan..."
                          : active.type === "group"
                            ? "Tulis pesan atau mention #task..."
                            : "Tulis pesan..."
                      }
                    />

                    {/* Voice Note or Send Button */}
                    {message.trim().length === 0 && !pendingAttachment && !editingMessage ? (
                      <button
                        onClick={handleStartRecording}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        title="Rekam pesan suara"
                        aria-label="Rekam pesan suara"
                      >
                        <Mic size={17} />
                      </button>
                    ) : (
                      <button
                        onClick={submit}
                        className="rounded-lg bg-violet-600 p-2 text-white transition hover:bg-violet-700 dark:bg-violet-500 dark:text-white dark:hover:bg-violet-400"
                        aria-label={editingMessage ? "Simpan perubahan" : "Kirim pesan"}
                        title={editingMessage ? "Simpan perubahan" : "Kirim"}
                      >
                        {editingMessage ? <Check size={15} /> : <Send size={15} />}
                      </button>
                    )}
                  </div>
                )}
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

      {/* MODAL: Forward Message (WhatsApp style) */}
      {forwardModalOpen && forwardingMessage && (
        <Modal title="Teruskan pesan ke..." onClose={() => setForwardModalOpen(false)}>
          {/* Quoted Message Preview */}
          <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1 flex items-center gap-1 text-[10px] text-zinc-400">
              <CornerUpRight size={11} />
              <span>Diteruskan</span>
            </div>
            <p className="line-clamp-3 text-zinc-700 dark:text-zinc-300">
              {forwardingMessage.text}
            </p>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              placeholder="Cari obrolan atau grup..."
              className={cn(inputClass, "pl-9 text-xs")}
            />
          </div>

          <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {chats
              .filter((c) =>
                resolveChatDisplayName(c, currentUser)
                  .toLowerCase()
                  .includes(forwardSearch.toLowerCase()),
              )
              .map((c) => {
                const isSelected = selectedForwardRooms.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedForwardRooms((prev) =>
                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                      );
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs transition",
                      isSelected
                        ? "bg-violet-50 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold dark:bg-zinc-800">
                        {c.type === "group" ? (
                          <Users size={12} />
                        ) : (
                          resolveChatDisplayName(c, currentUser).slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="font-medium">
                        {resolveChatDisplayName(c, currentUser)}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 rounded accent-violet-600"
                    />
                  </button>
                );
              })}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setForwardModalOpen(false)}>Batal</Button>
            <Button
              variant="primary"
              disabled={selectedForwardRooms.length === 0}
              onClick={handleConfirmForward}
            >
              Teruskan ({selectedForwardRooms.length})
            </Button>
          </div>
        </Modal>
      )}

      {/* MODAL: Delete Message (WhatsApp style: Delete for Everyone vs Delete for Me) */}
      {deleteModalOpen && deletingMessage && (
        <Modal title="Hapus pesan?" onClose={() => setDeleteModalOpen(false)}>
          <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <p className="line-clamp-2 italic text-zinc-600 dark:text-zinc-400">
              "{deletingMessage.text}"
            </p>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-zinc-500">
            {deletingMessage.mine
              ? 'Anda dapat menghapus pesan ini hanya untuk diri Anda sendiri, atau menghapusnya untuk semua anggota percakapan (akan menampilkan pesan "Pesan ini telah dihapus").'
              : "Hapus pesan ini dari tampilan Anda. Anggota percakapan lain tetap dapat melihatnya."}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setDeleteModalOpen(false)}>Batal</Button>
            <Button variant="secondary" onClick={() => handleConfirmDelete(false)}>
              Hapus untuk saya
            </Button>
            {deletingMessage.mine && (
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => handleConfirmDelete(true)}
              >
                Hapus untuk semua orang
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: Message Info (WhatsApp style) */}
      {infoModalOpen && infoMessage && (
        <Modal title="Info Pesan" onClose={() => setInfoModalOpen(false)}>
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-800 dark:text-zinc-200">{infoMessage.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">Pengirim</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {infoMessage.sender}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">Waktu Kirim</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {infoMessage.time}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">Status</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {infoMessage.status === "read" ? "Dibaca (Read)" : "Terkirim"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">Diedit</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {infoMessage.isEdited ? "Ya" : "Tidak"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => setInfoModalOpen(false)}>Tutup</Button>
          </div>
        </Modal>
      )}

      {/* MODAL: Starred Messages */}
      {starredModalOpen && (
        <Modal
          title={`Pesan Berbintang (${starredMessages.length})`}
          onClose={() => setStarredModalOpen(false)}
        >
          {starredMessages.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400">
              Belum ada pesan yang dibintangi dalam percakapan ini.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {starredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => {
                    setStarredModalOpen(false);
                    jumpToMessage(msg.id);
                  }}
                  className="group flex cursor-pointer items-start justify-between rounded-xl border border-zinc-200 p-2.5 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                        {msg.sender}
                      </span>
                      <span className="text-[10px] text-zinc-400">{msg.time}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {msg.text}
                    </p>
                  </div>
                  <Star size={14} className="shrink-0 fill-amber-400 text-amber-500" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <Button onClick={() => setStarredModalOpen(false)}>Tutup</Button>
          </div>
        </Modal>
      )}

      {/* MODAL: Add Friend */}
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
