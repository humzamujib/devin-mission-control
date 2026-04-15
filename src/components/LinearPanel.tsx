"use client";

import { useState, useEffect } from "react";

type LinearTicket = {
  id: string;
  title: string;
  status: string;
  priority: { value: number; name: string } | null;
  labels: string[];
  team: string;
  project: string;
  url: string;
  dueDate: string | null;
  description: string;
};

type LinearPanelProps = {
  open: boolean;
  onClose: () => void;
  onCreateSession: (prompt: string) => void;
  activeSessionTitles: string[];
};

const priorityColors: Record<number, string> = {
  1: "bg-t-error/20 text-t-error",
  2: "bg-t-warning/20 text-t-warning",
  3: "bg-t-info/20 text-t-info",
  4: "bg-t-text-muted/20 text-t-text-muted",
};

export default function LinearPanel({
  open,
  onClose,
  onCreateSession,
  activeSessionTitles,
}: LinearPanelProps) {
  const [tickets, setTickets] = useState<LinearTicket[]>([]);
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSessionId, setSyncSessionId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState("");

  useEffect(() => {
    if (!open) return;

    // Reset state and fetch
    setError(null);
    setTickets([]);
    setExportedAt(null);

    const fetchTickets = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/linear/issues");
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          setTickets(data.tickets || []);
          setExportedAt(data.exportedAt || null);
        }
      } catch {
        setError("Failed to fetch tickets");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [open]);

  // Poll sync session status
  useEffect(() => {
    if (!syncSessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/devin/sessions/${syncSessionId}`);
        const data = await res.json();
        const status = data.status_enum || data.status || "";
        setSyncStatus(status);
        if (status === "finished" || status === "stopped") {
          clearInterval(interval);
          setSyncing(false);
          setSyncSessionId(null);
          setSyncStatus(null);
          // Re-fetch tickets after sync completes
          const ticketRes = await fetch("/api/linear/issues");
          const ticketData = await ticketRes.json();
          if (!ticketData.error) {
            setTickets(ticketData.tickets || []);
            setExportedAt(ticketData.exportedAt || null);
          }
        }
      } catch {
        // keep polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [syncSessionId]);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus("starting");
    const res = await fetch("/api/linear/sync", { method: "POST" });
    const data = await res.json();
    if (data.session_id) {
      setSyncSessionId(data.session_id);
      setSyncStatus("working");
    } else {
      setSyncing(false);
      setSyncStatus(null);
    }
  }

  function handleStartSession(ticket: LinearTicket) {
    const parts = [
      `Work on Linear issue ${ticket.id}: "${ticket.title}"`,
      `Linear URL: ${ticket.url}`,
      `Team: ${ticket.team}`,
      `Priority: ${ticket.priority?.name ?? "None"}`,
    ];
    if (ticket.description) {
      parts.push(`\nDescription:\n${ticket.description}`);
    }
    if (extraPrompt.trim()) {
      parts.push(`\nAdditional instructions:\n${extraPrompt}`);
    }
    onCreateSession(parts.join("\n"));
    setExpandedId(null);
    setExtraPrompt("");
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExtraPrompt("");
    } else {
      setExpandedId(id);
      setExtraPrompt("");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-40 flex w-96 flex-col border-r border-t-border bg-t-bg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-t-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-t-primary" />
          <h2 className="text-sm font-semibold text-t-text-bright">
            Linear Tickets
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-t-text-muted transition-colors hover:text-t-text-secondary"
        >
          &times;
        </button>
      </div>

      {/* Sync bar */}
      <div className="flex items-center justify-between border-b border-t-border px-5 py-2">
        <span className="text-[10px] text-t-text-muted">
          {exportedAt
            ? `Synced ${new Date(exportedAt).toLocaleString()}`
            : "Not synced"}
        </span>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded bg-t-primary/20 px-2 py-0.5 text-[10px] font-medium text-t-accent transition-colors hover:bg-t-primary/40 disabled:opacity-50"
        >
          {syncing
            ? syncStatus === "starting"
              ? "Starting..."
              : `Syncing (${syncStatus})...`
            : "Sync"}
        </button>
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="p-4 text-xs text-t-text-muted">Loading tickets...</p>
        )}
        {error && (
          <div className="m-3 rounded-lg border border-t-error/30 bg-t-error/10 px-3 py-2 text-xs text-t-error">
            {error}
          </div>
        )}
        {!loading && !error && tickets.length === 0 && (
          <p className="p-4 text-xs text-t-text-muted">
            No actionable tickets
          </p>
        )}
        {!loading &&
          !error &&
          tickets.map((ticket) => {
            const isExpanded = expandedId === ticket.id;
            const hasActiveSession = activeSessionTitles.some(
              (t) => t.includes(ticket.id)
            );
            const pColor =
              priorityColors[ticket.priority?.value ?? 4] ||
              "bg-t-text-muted/20 text-t-text-muted";
            return (
              <div
                key={ticket.id}
                className={`border-b border-t-border/50 ${hasActiveSession ? "opacity-50" : ""}`}
              >
                {/* Ticket summary */}
                <button
                  onClick={() => !hasActiveSession && toggleExpand(ticket.id)}
                  disabled={hasActiveSession}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    hasActiveSession
                      ? "cursor-not-allowed"
                      : isExpanded
                        ? "bg-t-surface"
                        : "hover:bg-t-surface-hover"
                  }`}
                >
                  {hasActiveSession && (
                    <span className="mb-1 inline-block rounded bg-t-success/15 px-1.5 py-0.5 text-[10px] font-medium text-t-success">
                      Session active
                    </span>
                  )}
                  <div className="mb-1 flex items-center gap-2">
                    <a
                      href={ticket.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium text-t-accent hover:text-t-text-bright"
                    >
                      {ticket.id}
                    </a>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${pColor}`}
                    >
                      {ticket.priority?.name ?? "None"}
                    </span>
                    <span className="rounded bg-t-border px-1.5 py-0.5 text-[10px] text-t-text-muted">
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-sm text-t-text line-clamp-2">
                    {ticket.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-t-text-muted">
                      {ticket.team}
                    </span>
                    {ticket.labels.length > 0 && (
                      <span className="text-[10px] text-t-text-muted">
                        {ticket.labels.join(", ")}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-t-border bg-t-surface px-4 py-3">
                    {ticket.description && (
                      <div className="mb-3 max-h-40 overflow-y-auto rounded border border-t-border bg-t-bg px-3 py-2">
                        <p className="whitespace-pre-wrap text-xs text-t-text-secondary">
                          {ticket.description}
                        </p>
                      </div>
                    )}
                    <div className="mb-2">
                      <a
                        href={ticket.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-t-accent hover:text-t-text-bright"
                      >
                        Open in Linear
                      </a>
                    </div>
                    <textarea
                      value={extraPrompt}
                      onChange={(e) => setExtraPrompt(e.target.value)}
                      placeholder="Additional instructions for Devin (optional)..."
                      rows={3}
                      className="mb-2 w-full rounded border border-t-border bg-t-bg px-3 py-2 text-xs text-t-text placeholder-t-text-muted outline-none focus:border-t-primary"
                    />
                    <button
                      onClick={() => handleStartSession(ticket)}
                      className="w-full rounded bg-t-primary py-1.5 text-xs font-medium text-white transition-colors hover:bg-t-primary-hover"
                    >
                      Start Devin Session
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="border-t border-t-border px-5 py-2 text-[10px] text-t-text-muted">
        {tickets.length} actionable ticket{tickets.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
