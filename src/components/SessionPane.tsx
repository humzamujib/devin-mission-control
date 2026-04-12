"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { DevinSession } from "@/types";

type SessionMessage = {
  type: string;
  message: string;
  timestamp: string;
  origin?: string | null;
  username?: string | null;
};

type SessionPaneProps = {
  session: DevinSession;
  onClose: (id: string) => void;
  onTerminate: (id: string) => void;
};

const statusColors: Record<string, string> = {
  working: "text-t-success",
  running: "text-t-success",
  paused: "text-t-warning",
  finished: "text-t-info",
  stopped: "text-t-error",
  blocked: "text-t-warning",
};

function devinSessionUrl(sessionId: string): string {
  const id = sessionId.replace(/^devin-/, "");
  return `https://bilt.devinenterprise.com/sessions/${id}`;
}

function slackToMarkdown(text: string): string {
  return text
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "[$2]($1)")
    .replace(/<(https?:\/\/[^>]+)>/g, "[$1]($1)");
}

function isUserMessage(msg: SessionMessage): boolean {
  return (
    msg.type === "initial_user_message" ||
    msg.type === "user_message" ||
    msg.origin === "web" ||
    msg.origin === "api" ||
    msg.origin === "slack"
  );
}

export default function SessionPane({
  session,
  onClose,
  onTerminate,
}: SessionPaneProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(() => {
    fetch(`/api/devin/sessions/${session.session_id}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        if (Array.isArray(data.messages)) {
          setMessages((prev) => {
            // Only update + scroll if message count changed
            if (prev.length !== data.messages.length) return data.messages;
            return prev;
          });
        }
      })
      .catch(() => setDetail(null));
  }, [session.session_id]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 30_000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  const title =
    session.structured_output?.title ||
    session.title ||
    `Session ${session.session_id.slice(0, 8)}`;
  const sessionUrl = devinSessionUrl(session.session_id);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    await fetch(`/api/devin/sessions/${session.session_id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setMessage("");
    setSending(false);
    // Refresh messages shortly after sending so it appears
    setTimeout(fetchDetail, 2000);
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col border-r border-t-border last:border-r-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-t-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              session.status_enum === "working" || session.status_enum === "running"
                ? "bg-t-success"
                : session.status_enum === "blocked"
                  ? "bg-t-warning"
                  : "bg-t-info"
            }`}
          />
          <a
            href={sessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-t-text-bright truncate hover:text-t-accent"
            title={title}
          >
            {title}
          </a>
        </div>
        <button
          onClick={() => onClose(session.session_id)}
          className="shrink-0 ml-2 text-t-text-muted transition-colors hover:text-t-text-secondary"
        >
          &times;
        </button>
      </div>

      {/* Compact status bar */}
      <div className="flex items-center gap-3 border-b border-t-border px-3 py-1.5 text-[10px] text-t-text-muted shrink-0 flex-wrap">
        <span
          className={`font-medium uppercase ${statusColors[session.status_enum] || "text-t-text-muted"}`}
        >
          {session.status_enum}
        </span>
        {session.requesting_user_email && (
          <span>{session.requesting_user_email.split("@")[0]}</span>
        )}
        {session.pull_request && (
          <a
            href={session.pull_request.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-t-accent hover:text-t-text-bright"
          >
            PR #{session.pull_request.url.split("/").pop()}
          </a>
        )}
      </div>

      {/* Blocked banner */}
      {session.status_enum === "blocked" && (
        <div className="border-b border-t-border px-3 py-2 shrink-0">
          <a
            href={sessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded bg-t-warning px-2 py-0.5 text-[10px] font-medium text-t-bg hover:opacity-90"
          >
            Open in Devin to approve
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        {messages.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {messages.map((msg, i) => {
              const fromUser = isUserMessage(msg);
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-2.5 py-1.5 ${
                    fromUser
                      ? "border-t-msg-user-border bg-t-msg-user-bg ml-3"
                      : "border-t-msg-devin-border bg-t-msg-devin-bg mr-3"
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-medium ${
                        fromUser ? "text-t-accent" : "text-t-text-muted"
                      }`}
                    >
                      {fromUser ? msg.username || "You" : "Devin"}
                    </span>
                    {msg.timestamp && (
                      <span className="text-[9px] text-t-text-muted/50">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="prose-messages text-xs text-t-text min-w-0 break-words">
                    <ReactMarkdown>
                      {slackToMarkdown(msg.message)}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })}
          </div>
        ) : detail ? (
          <p className="text-xs text-t-text-muted">No messages yet</p>
        ) : (
          <p className="text-xs text-t-text-muted">Loading...</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer: terminate + send */}
      <div className="shrink-0 border-t border-t-border">
        {session.status_enum !== "finished" &&
          session.status_enum !== "stopped" && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              {(session.status_enum === "working" ||
                session.status_enum === "running" ||
                session.status_enum === "blocked") && (
                <form
                  onSubmit={handleSendMessage}
                  className="flex flex-1 gap-1.5"
                >
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Message Devin..."
                    className="flex-1 rounded border border-t-border bg-t-surface px-2 py-1 text-xs text-t-text placeholder-t-text-muted outline-none focus:border-t-primary"
                  />
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="rounded bg-t-primary px-2 py-1 text-xs font-medium text-white hover:bg-t-primary-hover disabled:opacity-50"
                  >
                    {sending ? "..." : "Send"}
                  </button>
                </form>
              )}
              <button
                onClick={async () => {
                  if (!confirm("Terminate this session?")) return;
                  setTerminating(true);
                  await fetch(
                    `/api/devin/sessions/${session.session_id}`,
                    { method: "DELETE" }
                  );
                  setTerminating(false);
                  onTerminate(session.session_id);
                }}
                disabled={terminating}
                className="shrink-0 rounded border border-t-error/30 px-2 py-1 text-[10px] text-t-error hover:bg-t-error/10 disabled:opacity-50"
              >
                {terminating ? "..." : "Stop"}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
