"use client";

import type { DevinSession, KanbanColumn, KanbanColumnId } from "@/types";
import SessionCard from "./SessionCard";

type KanbanBoardProps = {
  sessions: DevinSession[];
  onSelectSession: (session: DevinSession) => void;
};

const columns: { id: KanbanColumnId; title: string; color: string }[] = [
  { id: "queued", title: "Queued", color: "border-zinc-500" },
  { id: "running", title: "Running", color: "border-emerald-500" },
  { id: "blocked", title: "Needs Input", color: "border-orange-500" },
  { id: "finished", title: "Finished", color: "border-blue-500" },
];

function classifySession(session: DevinSession): KanbanColumnId {
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

function groupSessions(sessions: DevinSession[]): KanbanColumn[] {
  const groups: Record<KanbanColumnId, DevinSession[]> = {
    queued: [],
    running: [],
    blocked: [],
    finished: [],
  };

  for (const session of sessions) {
    const col = classifySession(session);
    groups[col].push(session);
  }

  return columns.map((col) => ({
    ...col,
    sessions: groups[col.id].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
  }));
}

export default function KanbanBoard({
  sessions,
  onSelectSession,
}: KanbanBoardProps) {
  const kanbanColumns = groupSessions(sessions);

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto p-6">
      {kanbanColumns.map((column) => (
        <div
          key={column.id}
          className="flex w-72 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950/50"
        >
          <div
            className={`flex items-center justify-between border-b border-zinc-800 px-4 py-3 border-t-2 ${column.color} rounded-t-xl`}
          >
            <h2 className="text-sm font-semibold text-zinc-300">
              {column.title}
            </h2>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
              {column.sessions.length}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {column.sessions.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-700">
                No sessions
              </p>
            ) : (
              column.sessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
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
