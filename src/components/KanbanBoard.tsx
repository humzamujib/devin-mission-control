"use client";

import type { DevinSession, KanbanColumn, KanbanColumnId } from "@/types";
import SessionCard from "./SessionCard";

type KanbanBoardProps = {
  sessions: DevinSession[];
  openSessionIds: string[];
  dismissedIds: Set<string>;
  onSelectSession: (session: DevinSession) => void;
};

const columns: { id: KanbanColumnId; title: string; dotColor: string }[] = [
  { id: "queued", title: "Queued", dotColor: "bg-t-text-muted" },
  { id: "running", title: "Running", dotColor: "bg-t-success" },
  { id: "blocked", title: "Needs Input", dotColor: "bg-t-warning" },
  { id: "idle", title: "Idle", dotColor: "bg-t-accent-dim" },
  { id: "finished", title: "Finished", dotColor: "bg-t-info" },
];

function classifySession(session: DevinSession, dismissedIds?: Set<string>): KanbanColumnId {
  if (dismissedIds?.has(session.session_id)) {
    return "idle";
  }
  switch (session.status_enum) {
    case "working":
    case "running":
      return "running";
    case "paused":
    case "blocked":
      return "blocked";
    case "finished":
    case "stopped":
      return "finished";
    default:
      return "queued";
  }
}

function groupSessions(sessions: DevinSession[], dismissedIds: Set<string>): KanbanColumn[] {
  const groups: Record<KanbanColumnId, DevinSession[]> = {
    queued: [],
    running: [],
    blocked: [],
    idle: [],
    finished: [],
  };

  for (const session of sessions) {
    const col = classifySession(session, dismissedIds);
    groups[col].push(session);
  }

  return columns.map((col) => ({
    ...col,
    color: col.dotColor,
    sessions: groups[col.id].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
  }));
}

export default function KanbanBoard({
  sessions,
  openSessionIds,
  dismissedIds,
  onSelectSession,
}: KanbanBoardProps) {
  const kanbanColumns = groupSessions(sessions, dismissedIds);

  return (
    <div className="flex h-full gap-5 overflow-x-auto overflow-y-hidden p-6">
      {kanbanColumns.map((column) => (
        <div
          key={column.id}
          className="flex w-72 shrink-0 flex-col rounded-xl bg-t-surface/60"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${column.color}`} />
              <h2 className="text-sm font-semibold text-t-text-secondary">
                {column.title}
              </h2>
            </div>
            {column.id !== "finished" && column.id !== "idle" && (
              <span className="rounded-full bg-t-surface-hover px-2 py-0.5 text-xs text-t-text-muted">
                {column.sessions.length}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {column.sessions.length === 0 ? (
              <p className="py-8 text-center text-xs text-t-text-muted">
                No sessions
              </p>
            ) : (
              column.sessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  isOpen={openSessionIds.includes(session.session_id)}
                  displayStatus={column.id === "idle" ? "idle" : undefined}
                  onClick={onSelectSession}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
