"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { SessionRecord } from "@/lib/vault";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type VaultSessionDetailPanelProps = {
  sessionId: string | null;
  /** Pre-fetched session from the parent's vault records. Avoids re-fetching the full list. */
  session?: SessionRecord | null;
  onClose: () => void;
};

const SOURCE_COLORS = {
  claude: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  devin: "bg-green-500/15 text-green-600 border-green-500/30",
  auto: "bg-blue-500/15 text-blue-600 border-blue-500/30",
};

function formatDuration(durationMs?: number): string {
  if (!durationMs) return "Unknown";
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatCost(costUsd?: number): string {
  if (!costUsd) return "Unknown";
  return `$${costUsd.toFixed(4)}`;
}

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

export default function VaultSessionDetailPanel({
  sessionId,
  session: parentSession,
  onClose,
}: VaultSessionDetailPanelProps) {
  const [fetchedSession, setFetchedSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use parent-provided session when available; fall back to fetching if not
  const session = parentSession ?? fetchedSession;

  useEffect(() => {
    if (!sessionId || parentSession) {
      return;
    }

    // Fallback: fetch session details if parent didn't provide them
    const ac = new AbortController();
    const fetchSession = async () => {
      setFetchedSession(null);
      setLoading(true);
      setError(null);

      try {
        const actualId = sessionId.replace(/^vault-/, "");
        const response = await fetch("/api/vault/sessions", { signal: ac.signal });
        const data = await response.json();

        const sessionRecord = (data.sessions || []).find(
          (s: SessionRecord) => s.id === actualId
        );

        if (sessionRecord) {
          setFetchedSession(sessionRecord);
        } else {
          setError("Session not found");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to load session details");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    return () => ac.abort();
  }, [sessionId, parentSession]);

  if (!sessionId) return null;

  const sourceColor = SOURCE_COLORS[session?.source as keyof typeof SOURCE_COLORS] || SOURCE_COLORS.auto;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-t-border bg-t-bg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-t-border px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className={sourceColor}>
            {session?.source || "vault"}
          </Badge>
          <h2 className="text-sm font-semibold text-t-text-bright truncate">
            {session?.title || "Loading..."}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="shrink-0 h-6 w-6 p-0 text-t-text-muted hover:text-t-text-secondary"
        >
          ×
        </Button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-t-text-muted">Loading session details...</p>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="text-center">
            <p className="text-sm text-t-error mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {session && !loading && (
        <>
          {/* Session Info */}
          <div className="border-b border-t-border px-5 py-3 space-y-3">
            {/* Status and Repository */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Status</span>
              <Badge variant="secondary" className="text-t-success">
                {session.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Repository</span>
              <span className="text-xs text-t-text-secondary font-mono">
                {session.repo}
              </span>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Started</span>
              <span className="text-xs text-t-text-secondary">
                {new Date(session.created_at).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Completed</span>
              <span className="text-xs text-t-text-secondary">
                {timeAgo(session.completed_at)}
              </span>
            </div>

            {/* Key Metrics */}
            {session.duration_ms && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-text-muted">Duration</span>
                <span className="text-xs text-t-text-secondary">
                  {formatDuration(session.duration_ms)}
                </span>
              </div>
            )}

            {session.cost_usd && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-text-muted">Cost</span>
                <span className="text-xs text-t-text-secondary">
                  {formatCost(session.cost_usd)}
                </span>
              </div>
            )}

            {session.model && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-text-muted">Model</span>
                <span className="text-xs text-t-text-secondary">
                  {session.model}
                </span>
              </div>
            )}

            {/* Tools Used */}
            {session.tools_used && session.tools_used.length > 0 && (
              <div>
                <span className="text-xs text-t-text-muted block mb-2">
                  Tools Used ({session.tools_used.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {session.tools_used.map((tool, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Session ID */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-t-text-muted">Session ID</span>
              <span className="text-xs text-t-text-secondary font-mono">
                {session.id.slice(0, 16)}...
              </span>
            </div>
          </div>

          {/* Initial Prompt */}
          {session.prompt && (
            <div className="border-b border-t-border px-5 py-3">
              <h3 className="text-xs font-medium text-t-text-muted mb-2">
                Initial Prompt
              </h3>
              <div className="rounded-lg border border-t-border bg-t-surface px-3 py-2">
                <div className="prose-messages text-xs text-t-text">
                  <ReactMarkdown>{session.prompt}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Final Result */}
          {session.result && (
            <div className="border-b border-t-border px-5 py-3">
              <h3 className="text-xs font-medium text-t-text-muted mb-2">
                Final Result
              </h3>
              <div className="rounded-lg border border-t-border bg-t-surface px-3 py-2">
                <div className="prose-messages text-xs text-t-text">
                  <ReactMarkdown>{session.result}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Messages/Conversation Highlights */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-t-border">
              <h3 className="text-xs font-medium text-t-text-muted">
                Conversation ({session.messages?.length || 0} messages)
              </h3>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-5 py-3 space-y-3">
                {session.messages && session.messages.length > 0 ? (
                  session.messages.map((msg, i) => {
                    const isUser = msg.type === "user" || msg.type.includes("user");
                    return (
                      <div key={i} className="flex gap-2">
                        <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                          <AvatarFallback
                            className={`text-[9px] font-medium ${
                              isUser
                                ? "bg-t-primary/20 text-t-primary"
                                : "bg-purple-500/15 text-purple-600"
                            }`}
                          >
                            {isUser ? "U" : "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg border px-2.5 py-1.5 max-w-[85%] bg-t-surface">
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-medium ${
                                isUser ? "text-t-accent" : "text-purple-600"
                              }`}
                            >
                              {isUser ? "User" : "Assistant"}
                            </span>
                            {msg.timestamp && (
                              <span className="text-[9px] text-t-text-muted/50">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          <div className="prose-messages text-xs text-t-text min-w-0 break-words">
                            <ReactMarkdown>
                              {msg.text.length > 200
                                ? `${msg.text.slice(0, 200)}...`
                                : msg.text}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-t-text-muted py-4 text-center">
                    No conversation messages available
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Footer - vault info */}
          <div className="border-t border-t-border px-5 py-3 text-center">
            <p className="text-xs text-t-text-muted">
              Complete session record stored in vault
            </p>
          </div>
        </>
      )}
    </div>
  );
}