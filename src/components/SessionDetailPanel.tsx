"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  if (!session) return null;

  const title =
    session.structured_output?.title ||
    session.title ||
    `Session ${session.session_id.slice(0, 8)}`;
  const sessionUrl = devinSessionUrl(session.session_id);

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
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-t-border bg-t-bg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-t-border px-5 py-4">
        <h2 className="text-sm font-semibold text-t-text-bright truncate">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="text-t-text-muted transition-colors hover:text-t-text-secondary"
        >
          &times;
        </button>
      </div>

      {/* Status */}
      <div className="border-b border-t-border px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-t-text-muted">Status</span>
          <span
            className={`text-xs font-medium uppercase ${statusColors[session.status_enum] || "text-t-text-muted"}`}
          >
            {session.status_enum}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-t-text-muted">Session ID</span>
          <a
            href={sessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-t-accent hover:text-t-text-bright"
          >
            {session.session_id.slice(0, 16)}...
          </a>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-t-text-muted">Created</span>
          <span className="text-xs text-t-text-secondary">
            {new Date(session.created_at).toLocaleString()}
          </span>
        </div>
        {session.requesting_user_email && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-t-text-muted">Requested by</span>
            <span className="text-xs text-t-text-secondary">
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
              className="text-xs text-t-accent hover:text-t-text-bright"
            >
              PR #{session.pull_request.url.split("/").pop()}
            </a>
          </div>
        )}
      </div>

      {/* Blocked — prompt to open in Devin for approval */}
      {session.status_enum === "blocked" && (
        <div className="border-b border-t-border px-5 py-3">
          <div className="rounded-lg border border-t-warning/30 bg-t-warning/10 px-3 py-2">
            <p className="text-xs text-t-warning">
              This session needs attention.
            </p>
            <a
              href={sessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block rounded bg-t-warning px-3 py-1 text-xs font-medium text-t-bg transition-colors hover:opacity-90"
            >
              Open in Devin to approve
            </a>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-3">
        <p className="mb-2 text-xs font-medium text-t-text-muted">
          Messages ({messages.length})
        </p>
        {messages.length > 0 ? (
          <div className="flex flex-col gap-2">
            {messages.map((msg, i) => {
              const fromUser = isUserMessage(msg);
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2 ${
                    fromUser
                      ? "border-t-msg-user-border bg-t-msg-user-bg ml-4"
                      : "border-t-msg-devin-border bg-t-msg-devin-bg mr-4"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-medium ${
                        fromUser ? "text-t-accent" : "text-t-text-muted"
                      }`}
                    >
                      {fromUser
                        ? msg.username || "You"
                        : "Devin"}
                    </span>
                    {msg.timestamp && (
                      <span className="text-[10px] text-t-text-muted/50">
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

      {/* Terminate */}
      {session.status_enum !== "finished" &&
        session.status_enum !== "stopped" && (
          <div className="border-t border-t-border px-5 py-2">
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
              className="w-full rounded-lg border border-t-error/30 bg-t-error/10 py-1.5 text-xs text-t-error transition-colors hover:bg-t-error/20 disabled:opacity-50"
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
          className="border-t border-t-border p-4"
        >
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send a message to Devin..."
              className="flex-1 rounded-lg border border-t-border bg-t-surface px-3 py-2 text-sm text-t-text placeholder-t-text-muted outline-none focus:border-t-primary"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-lg bg-t-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-t-primary-hover disabled:opacity-50"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
