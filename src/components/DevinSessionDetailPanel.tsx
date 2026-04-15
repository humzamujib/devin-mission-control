"use client";

import { useState, useEffect, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { DevinSession } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SessionMessage = {
  type: string;
  message: string;
  timestamp: string;
  origin?: string | null;
  username?: string | null;
};

type DevinSessionDetailPanelProps = {
  session: DevinSession | null;
  onClose: () => void;
};

const DEVIN_BASE =
  process.env.NEXT_PUBLIC_DEVIN_ENTERPRISE_URL || "https://app.devin.ai";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
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

const MessageItem = memo(function MessageItem({ msg }: { msg: SessionMessage }) {
  const fromUser = isUserMessage(msg);
  return (
    <div className="flex gap-2">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarFallback
          className={`text-[9px] font-medium ${
            fromUser
              ? "bg-t-primary/20 text-t-primary"
              : "bg-t-surface-hover text-t-text-muted"
          }`}
        >
          {fromUser ? "U" : "D"}
        </AvatarFallback>
      </Avatar>
      <div className="rounded-lg border px-2.5 py-1.5 max-w-[85%] bg-t-surface">
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
          <ReactMarkdown>{slackToMarkdown(msg.message)}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
});

export default function DevinSessionDetailPanel({
  session,
  onClose,
}: DevinSessionDetailPanelProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const ac = new AbortController();
    fetch(`/api/devin/sessions/${session.session_id}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.messages)) setMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [session?.session_id]);

  if (!session) return null;

  const title =
    session.structured_output?.title ||
    session.title ||
    `Session ${session.session_id.slice(0, 8)}`;
  const sessionUrl = `${DEVIN_BASE}/sessions/${session.session_id.replace(/^devin-/, "")}`;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-t-border bg-t-bg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-t-border px-5 py-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
            devin
          </Badge>
          <a
            href={sessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-t-text-bright truncate hover:text-t-accent"
          >
            {title}
          </a>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="shrink-0 h-6 w-6 p-0 text-t-text-muted hover:text-t-text-secondary"
        >
          &times;
        </Button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-t-text-muted">Loading...</p>
        </div>
      )}

      {!loading && (
        <ScrollArea className="flex-1 min-h-0">
          {/* Session Info */}
          <div className="border-b border-t-border px-5 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Status</span>
              <Badge variant="secondary">{session.status_enum}</Badge>
            </div>

            {session.requesting_user_email && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-text-muted">User</span>
                <span className="text-xs text-t-text-secondary">
                  {session.requesting_user_email.split("@")[0]}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Created</span>
              <span className="text-xs text-t-text-secondary">
                {new Date(session.created_at).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Updated</span>
              <span className="text-xs text-t-text-secondary">
                {timeAgo(session.updated_at)}
              </span>
            </div>

            {session.pull_request?.url && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-text-muted">PR</span>
                <a
                  href={session.pull_request.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs font-medium ${
                    session.pull_request.merged
                      ? "text-t-success"
                      : "text-t-accent"
                  }`}
                >
                  #{session.pull_request.url.split("/").pop()}
                  {session.pull_request.merged ? " (merged)" : session.pull_request.closed ? " (closed)" : " (open)"}
                </a>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Session</span>
              <a
                href={sessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-t-accent hover:text-t-text-bright"
              >
                Open in Devin
              </a>
            </div>
          </div>

          {/* Summary */}
          {session.structured_output?.summary && (
            <div className="border-b border-t-border px-5 py-3">
              <h3 className="text-xs font-medium text-t-text-muted mb-2">
                Summary
              </h3>
              <div className="rounded-lg border border-t-border bg-t-surface px-3 py-2">
                <div className="prose-messages text-xs text-t-text">
                  <ReactMarkdown>{session.structured_output.summary}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div>
            <div className="px-5 py-3 border-b border-t-border">
              <h3 className="text-xs font-medium text-t-text-muted">
                Messages ({messages.length})
              </h3>
            </div>
            <div className="px-5 py-3 space-y-3">
              {messages.length > 0 ? (
                messages.map((msg, i) => (
                  <MessageItem key={i} msg={msg} />
                ))
              ) : (
                <p className="text-xs text-t-text-muted py-4 text-center">
                  No messages available
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
