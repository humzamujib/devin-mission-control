"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { ClaudeSession } from "@/types/claude-session";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type DisplayMessage = {
  type: "assistant" | "user" | "tool" | "result" | "ask_user" | "system";
  text: string;
  timestamp: string;
  toolName?: string;
};

type ClaudeSessionPaneProps = {
  session: ClaudeSession;
  accentColor?: string;
  onClose: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ClaudeSession>) => void;
};

const ClaudeMessage = memo(function ClaudeMessage({ msg }: { msg: DisplayMessage }) {
  if (msg.type === "tool") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-t-surface-hover text-[9px] text-t-text-muted">
        <span className="font-mono">{msg.toolName}</span>
        <span className="truncate">{msg.text}</span>
      </div>
    );
  }

  if (msg.type === "result") {
    return (
      <div className="rounded-lg border border-t-border bg-t-surface px-3 py-2 text-center">
        <p className="text-[10px] text-t-text-muted">Session ended</p>
        <div className="prose-messages text-xs text-t-text mt-1">
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const fromUser = msg.type === "user";
  return (
    <div className={`flex gap-2 ${fromUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarFallback
          className={`text-[9px] font-medium ${
            fromUser
              ? "bg-t-primary/20 text-t-primary"
              : "bg-purple-500/15 text-purple-600"
          }`}
        >
          {fromUser ? "U" : "C"}
        </AvatarFallback>
      </Avatar>
      <div
        className={`rounded-lg border px-2.5 py-1.5 max-w-[85%] ${
          fromUser
            ? "border-t-msg-user-border bg-t-msg-user-bg"
            : "border-t-msg-devin-border bg-t-msg-devin-bg"
        }`}
      >
        <div className="mb-0.5 flex items-center gap-1.5">
          <span
            className={`text-[9px] font-medium ${
              fromUser ? "text-t-accent" : "text-purple-600"
            }`}
          >
            {fromUser ? "You" : "Claude"}
          </span>
          {msg.timestamp && (
            <span className="text-[9px] text-t-text-muted/50">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="prose-messages text-xs text-t-text min-w-0 break-words">
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
});

export default function ClaudeSessionPane({
  session,
  accentColor,
  onClose,
  onUpdate,
}: ClaudeSessionPaneProps) {
  const [sdkMessages, setSdkMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isSdkSession = session.id.startsWith("sdk-");

  // For auto-discovered sessions, map messages from props
  const autoMessages = useMemo(() => {
    if (isSdkSession || !session.messages) return [];

    return session.messages.map((m) => ({
      type: m.role === "user" ? "user" : "assistant",
      text: m.text,
      timestamp: m.timestamp,
    })) as DisplayMessage[];
  }, [isSdkSession, session.messages]);

  // Use appropriate messages based on session type
  const messages = isSdkSession ? sdkMessages : autoMessages;

  // Connect to SSE stream for SDK sessions
  useEffect(() => {
    if (!isSdkSession) return;

    const es = new EventSource(`/api/claude/sessions/${session.id}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as DisplayMessage;
        setSdkMessages((prev) => [...prev, msg]);

        if (msg.type === "result") {
          onUpdate(session.id, { status: "done" });
          es.close();
          setConnected(false);
        } else if (msg.type === "ask_user") {
          onUpdate(session.id, { status: "blocked" });
        }
      } catch {
        // Skip non-JSON messages (heartbeats)
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isSdkSession, session.id, onUpdate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !isSdkSession) return;

    setSending(true);
    await fetch(`/api/claude/sessions/${session.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    setInput("");
    setSending(false);
    onUpdate(session.id, { status: "running" });
  }

  async function handleStop() {
    await fetch(`/api/claude/sessions/${session.id}/stop`, {
      method: "POST",
    });
    onUpdate(session.id, { status: "done" });
  }

  const isWaiting = session.status === "blocked";
  const isRunning = session.status === "running";
  const isDone = session.status === "done";

  const statusBadge = isRunning
    ? "bg-purple-500/15 text-purple-600 border-purple-500/30"
    : isWaiting
      ? "bg-t-warning/15 text-t-warning border-t-warning/30"
      : "bg-t-text-muted/15 text-t-text-muted border-t-text-muted/30";

  return (
    <div
      style={accentColor ? { borderTopColor: accentColor } : undefined}
      className={`flex flex-1 min-w-0 min-h-0 flex-col border-r border-t-border last:border-r-0 overflow-hidden ${accentColor ? "border-t-[3px]" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={statusBadge}>claude</Badge>
          <span
            className="text-xs font-medium text-t-text-bright truncate"
            title={session.title}
          >
            {session.title}
          </span>
          {isSdkSession && connected && isRunning && (
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose(session.id)}
          className="shrink-0 h-6 w-6 p-0 text-t-text-muted hover:text-t-text-secondary"
        >
          &times;
        </Button>
      </div>

      <Separator />

      {/* Info bar */}
      <div className="flex items-center gap-2 px-3 h-8 text-[10px] text-t-text-muted shrink-0">
        <span>{session.repo}</span>
        {isSdkSession && <span>{connected ? "connected" : "disconnected"}</span>}
        {!isSdkSession && session.pid && <span>PID {session.pid}</span>}
        <span>{session.status}</span>
      </div>

      {isWaiting && (
        <>
          <Separator />
          <div className="px-3 py-2 shrink-0">
            <div className="rounded-lg border border-t-warning/30 bg-t-warning/10 px-3 py-2 text-center">
              <p className="text-xs font-medium text-t-warning">
                Needs your response
              </p>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 h-0">
        <div className="flex flex-col gap-2 px-3 py-2">
          {messages.length > 0 ? (
            messages
              .filter((m) => m.type !== "system")
              .map((msg, i) => (
                <ClaudeMessage key={i} msg={msg} />
              ))
          ) : (
            <p className="text-xs text-t-text-muted py-4 text-center">
              {isSdkSession ? "Starting session..." : "No messages yet"}
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Footer — input for SDK sessions */}
      {isSdkSession && !isDone && (
        <>
          <Separator />
          <div className="shrink-0 px-3 py-2">
            <form onSubmit={handleSend} className="flex gap-1.5 mb-1.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isWaiting ? "Respond to Claude..." : "Send a message..."
                }
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={sending || !input.trim()}
                className="h-8 px-3 text-xs"
              >
                {sending ? "..." : "Send"}
              </Button>
            </form>
            <div className="flex items-center gap-2">
              {isRunning && (
                <button
                  onClick={handleStop}
                  className="text-[10px] text-t-text-muted hover:text-t-error"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer for auto-discovered sessions */}
      {!isSdkSession && (
        <>
          <Separator />
          <div className="shrink-0 px-3 py-2 flex items-center gap-2">
            {session.cwd && (
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      `Kill all claude processes in ${session.repo}?`
                    )
                  )
                    return;
                  await fetch("/api/local/kill", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cwd: session.cwd }),
                  });
                  onClose(session.id);
                }}
                className="text-[10px] text-t-text-muted hover:text-t-error"
              >
                Kill
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
