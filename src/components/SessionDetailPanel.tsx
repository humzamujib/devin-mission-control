"use client";

import { useState, useEffect } from "react";
import type { DevinSession } from "@/types";

type SessionMessage = {
  type: string;
  message: string;
  timestamp: string;
  origin?: string | null;
  username?: string | null;
};

type SessionDetailPanelProps = {
  session: DevinSession | null;
  onClose: () => void;
  onTerminate?: (sessionId: string) => void;
};

const statusColors: Record<string, string> = {
  working: "text-emerald-400",
  running: "text-emerald-400",
  paused: "text-amber-400",
  finished: "text-blue-400",
  stopped: "text-red-400",
  blocked: "text-orange-400",
};

export default function SessionDetailPanel({
  session,
  onClose,
  onTerminate,
}: SessionDetailPanelProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);

  useEffect(() => {
    if (!session) {
      setDetail(null);
      return;
    }
    fetch(`/api/devin/sessions/${session.session_id}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => setDetail(null));
  }, [session]);

  if (!session) return null;

  const title =
    session.structured_output?.title ||
    session.title ||
    `Session ${session.session_id.slice(0, 8)}`;

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !session) return;
    setSending(true);
    await fetch(`/api/devin/sessions/${session.session_id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setMessage("");
    setSending(false);
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
        <button
          onClick={onClose}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          &times;
        </button>
      </div>

      {/* Status */}
      <div className="border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Status</span>
          <span
            className={`text-xs font-medium uppercase ${statusColors[session.status_enum] || "text-zinc-400"}`}
          >
            {session.status_enum}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Session ID</span>
          <code className="text-xs text-zinc-400">
            {session.session_id.slice(0, 12)}...
          </code>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Created</span>
          <span className="text-xs text-zinc-400">
            {new Date(session.created_at).toLocaleString()}
          </span>
        </div>
        {session.url && (
          <div className="mt-2">
            <a
              href={session.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Open in Devin
            </a>
          </div>
        )}
        {session.requesting_user_email && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Requested by</span>
            <span className="text-xs text-zinc-400">
              {session.requesting_user_email.split("@")[0]}
            </span>
          </div>
        )}
        {session.pull_request && (
          <div className="mt-2">
            <a
              href={session.pull_request.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              PR #{session.pull_request.url.split("/").pop()}
            </a>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <p className="mb-2 text-xs font-medium text-zinc-500">
          Messages ({messages.length})
        </p>
        {messages.length > 0 ? (
          <div className="flex flex-col gap-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-500">
                    {msg.username || msg.origin || msg.type}
                  </span>
                  {msg.timestamp && (
                    <span className="text-[10px] text-zinc-700">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-xs text-zinc-300 line-clamp-6">
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        ) : detail ? (
          <p className="text-xs text-zinc-600">No messages yet</p>
        ) : (
          <p className="text-xs text-zinc-600">Loading...</p>
        )}
      </div>

      {/* Terminate */}
      {session.status_enum !== "finished" &&
        session.status_enum !== "stopped" && (
          <div className="border-t border-zinc-800 px-5 py-2">
            <button
              onClick={async () => {
                if (!confirm("Terminate this session?")) return;
                setTerminating(true);
                await fetch(`/api/devin/sessions/${session.session_id}`, {
                  method: "DELETE",
                });
                setTerminating(false);
                onTerminate?.(session.session_id);
                onClose();
              }}
              disabled={terminating}
              className="w-full rounded-lg border border-red-800/50 bg-red-950/30 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
            >
              {terminating ? "Terminating..." : "Terminate Session"}
            </button>
          </div>
        )}

      {/* Send message */}
      {(session.status_enum === "working" ||
        session.status_enum === "running" ||
        session.status_enum === "blocked") && (
        <form
          onSubmit={handleSendMessage}
          className="border-t border-zinc-800 p-4"
        >
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send a message to Devin..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
