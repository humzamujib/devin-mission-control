"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { DevinSession } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePageVisible } from "@/hooks/usePageVisible";

type SessionMessage = {
  type: string;
  message: string;
  timestamp: string;
  origin?: string | null;
  username?: string | null;
};

type SessionPaneProps = {
  session: DevinSession;
  isDismissed?: boolean;
  accentColor?: string;
  onClose: (id: string) => void;
  onTerminate: (id: string) => void;
  onWrapUp: (id: string) => void;
};

const DEVIN_BASE =
  process.env.NEXT_PUBLIC_DEVIN_ENTERPRISE_URL || "https://app.devin.ai";

function devinSessionUrl(sessionId: string): string {
  const id = sessionId.replace(/^devin-/, "");
  return `${DEVIN_BASE}/sessions/${id}`;
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

const DevinMessage = memo(function DevinMessage({ msg }: { msg: SessionMessage }) {
  const fromUser = isUserMessage(msg);
  return (
    <div className={`flex gap-2 ${fromUser ? "flex-row-reverse" : ""}`}>
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
    </div>
  );
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  working: "default",
  running: "default",
  blocked: "secondary",
  finished: "outline",
  stopped: "destructive",
};

export default function SessionPane({
  session,
  isDismissed,
  accentColor,
  onClose,
  onTerminate,
  onWrapUp,
}: SessionPaneProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [checkoutState, setCheckoutState] = useState<
    "idle" | "loading" | "success" | "error" | "already"
  >("idle");
  const [checkoutInfo, setCheckoutInfo] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageVisible = usePageVisible();

  // Fetch session detail for messages (the only data not in the parent's list poll).
  // Uses the parent's 15s cadence to stay aligned.
  const fetchDetail = useCallback((signal?: AbortSignal) => {
    fetch(`/api/devin/sessions/${session.session_id}`, { signal })
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        if (Array.isArray(data.messages)) {
          setMessages((prev) => {
            if (prev.length !== data.messages.length) return data.messages;
            return prev;
          });
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDetail(null);
      });
  }, [session.session_id]);

  useEffect(() => {
    if (!pageVisible) return;
    const ac = new AbortController();
    fetchDetail(ac.signal);
    const interval = setInterval(() => fetchDetail(ac.signal), 15_000);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [fetchDetail, pageVisible]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  // Check if PR branch is already checked out locally
  useEffect(() => {
    if (!session.pull_request) return;
    fetch(
      `/api/local/checkout?pr_url=${encodeURIComponent(session.pull_request.url)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.checked_out) {
          setCheckoutState("already");
          setCheckoutInfo(data.branch);
        }
      })
      .catch(() => {});
  }, [session.pull_request]);

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
    setTimeout(fetchDetail, 2000);
  }

  return (
    <div
      style={accentColor ? { borderTopColor: accentColor } : undefined}
      className={`flex flex-1 min-w-0 min-h-0 flex-col border-r border-t-border last:border-r-0 overflow-hidden ${accentColor ? "border-t-[3px]" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={statusVariant[session.status_enum] || "outline"}>
            {session.status_enum}
          </Badge>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose(session.session_id)}
          className="shrink-0 h-6 w-6 p-0 text-t-text-muted hover:text-t-text-secondary"
        >
          &times;
        </Button>
      </div>

      <Separator />

      {/* Compact info bar */}
      <div className="flex items-center gap-2 px-3 h-8 text-[10px] text-t-text-muted shrink-0 flex-wrap">
        {session.requesting_user_email && (
          <span>{session.requesting_user_email.split("@")[0]}</span>
        )}
        {session.pull_request && (
          <>
            <a
              href={session.pull_request.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-t-accent hover:text-t-text-bright"
            >
              PR #{session.pull_request.url.split("/").pop()}
            </a>
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={async () => {
                    setCheckoutState("loading");
                    setCheckoutInfo("");
                    const res = await fetch("/api/local/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        pr_url: session.pull_request!.url,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setCheckoutState("already");
                      setCheckoutInfo(data.branch);
                    } else {
                      setCheckoutState("error");
                      setCheckoutInfo(data.error || "Failed");
                      setTimeout(() => setCheckoutState("idle"), 5000);
                    }
                  }}
                  disabled={checkoutState === "loading"}
                  className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                    checkoutState === "success" || checkoutState === "already"
                      ? "bg-t-success/15 text-t-success"
                      : checkoutState === "error"
                        ? "bg-t-error/15 text-t-error"
                        : "bg-t-primary/15 text-t-primary hover:bg-t-primary/25"
                  } disabled:opacity-50`}
                >
                  {checkoutState === "loading"
                    ? "..."
                    : checkoutState === "already"
                      ? "On branch"
                      : checkoutState === "success"
                        ? "Checked out"
                        : checkoutState === "error"
                          ? "Failed"
                          : "Checkout"}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {checkoutInfo ||
                    "Fetch and checkout this branch locally"}
                </p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Blocked banner */}
      {session.status_enum === "blocked" && (
        <>
          <Separator />
          <div className="px-3 py-2 shrink-0">
            <a
              href={sessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-t-warning px-2 py-0.5 text-[10px] font-medium text-t-bg hover:opacity-90"
            >
              Open in Devin to approve
            </a>
          </div>
        </>
      )}

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 h-0">
        <div className="flex flex-col gap-2 px-3 py-2">
          {messages.length > 0 ? (
            messages.map((msg, i) => (
              <DevinMessage key={i} msg={msg} />
            ))
          ) : detail ? (
            <p className="text-xs text-t-text-muted py-4 text-center">
              No messages yet
            </p>
          ) : (
            <p className="text-xs text-t-text-muted py-4 text-center">
              Loading...
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Footer */}
      {(isDismissed ||
        (session.status_enum !== "finished" &&
          session.status_enum !== "stopped")) && (
        <>
          <Separator />
          <div className="shrink-0 px-3 py-2">
            {/* Message input */}
            {(isDismissed ||
              session.status_enum === "working" ||
              session.status_enum === "running" ||
              session.status_enum === "blocked") && (
              <form onSubmit={handleSendMessage} className="flex gap-1.5 mb-1.5">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message Devin..."
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={sending || !message.trim()}
                  className="h-8 px-3 text-xs"
                >
                  {sending ? "..." : "Send"}
                </Button>
              </form>
            )}
            {/* Actions */}
            <div className="flex items-center gap-2">
              {session.status_enum === "blocked" && !isDismissed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWrapUp(session.session_id)}
                  className="h-6 text-[10px] text-t-accent-dim"
                >
                  Move to Idle
                </Button>
              )}
              {session.status_enum === "blocked" && isDismissed && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sleeping}
                  onClick={async () => {
                    setSleeping(true);
                    await fetch(
                      `/api/devin/sessions/${session.session_id}/message`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message: "sleep" }),
                      }
                    );
                    setSleeping(false);
                    onClose(session.session_id);
                  }}
                  className="h-6 text-[10px] text-t-info"
                >
                  {sleeping ? "..." : "Sleep"}
                </Button>
              )}
              {session.status_enum !== "finished" &&
                session.status_enum !== "stopped" && (
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          "Terminate this session? This cannot be undone."
                        )
                      )
                        return;
                      setTerminating(true);
                      await fetch(
                        `/api/devin/sessions/${session.session_id}`,
                        { method: "DELETE" }
                      );
                      setTerminating(false);
                      onTerminate(session.session_id);
                    }}
                    disabled={terminating}
                    className="text-[10px] text-t-text-muted hover:text-t-error disabled:opacity-50"
                  >
                    {terminating ? "..." : "Terminate"}
                  </button>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
