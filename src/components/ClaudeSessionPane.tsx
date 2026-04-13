"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { ClaudeSession } from "@/types/claude-session";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type ClaudeSessionPaneProps = {
  session: ClaudeSession;
  accentColor?: string;
  onClose: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ClaudeSession>) => void;
  onDelete: (id: string) => void;
};

export default function ClaudeSessionPane({
  session,
  accentColor,
  onClose,
  onUpdate,
  onDelete,
}: ClaudeSessionPaneProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = session.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  const statusBadge =
    session.status === "blocked"
      ? "bg-t-warning/15 text-t-warning border-t-warning/30"
      : session.status === "running"
        ? "bg-purple-500/15 text-purple-600 border-purple-500/30"
        : "bg-t-text-muted/15 text-t-text-muted border-t-text-muted/30";

  return (
    <div
      style={accentColor ? { borderTopColor: accentColor } : undefined}
      className={`flex flex-1 min-w-0 flex-col border-r border-t-border last:border-r-0 overflow-hidden ${accentColor ? "border-t-[3px]" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={statusBadge}>
            claude
          </Badge>
          <span
            className="text-xs font-medium text-t-text-bright truncate"
            title={session.title}
          >
            {session.title}
          </span>
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
        {session.pid && <span>PID {session.pid}</span>}
        <span>{session.status}</span>
      </div>

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 px-3 py-2">
          {messages.length > 0 ? (
            messages.map((msg, i) => {
                const fromUser = msg.role === "user";
                return (
                  <div
                    key={i}
                    className={`flex gap-2 ${fromUser ? "flex-row-reverse" : ""}`}
                  >
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
              })
          ) : (
            <p className="text-xs text-t-text-muted py-4 text-center">
              No messages yet
            </p>
          )}
          {session.status === "blocked" && (
            <div className="rounded-lg border border-t-warning/30 bg-t-warning/10 px-3 py-2 text-center">
              <p className="text-xs font-medium text-t-warning">
                Needs your response
              </p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="shrink-0 px-3 py-2 flex items-center gap-2">
        {session.cwd && (
          <button
            onClick={async () => {
              if (!confirm(`Kill all claude processes in ${session.repo}?`)) return;
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
        {session.source === "manual" && (
          <button
            onClick={() => {
              if (!confirm("Delete this session?")) return;
              onDelete(session.id);
            }}
            className="text-[10px] text-t-text-muted hover:text-t-error"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
