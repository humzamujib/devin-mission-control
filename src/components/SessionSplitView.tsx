"use client";

import type { DevinSession } from "@/types";
import SessionPane from "./SessionPane";

type SessionSplitViewProps = {
  openSessionIds: string[];
  sessions: DevinSession[];
  boardExpanded: boolean;
  onToggleBoard: () => void;
  dismissedIds: Set<string>;
  onClose: (id: string) => void;
  onTerminate: (id: string) => void;
  onWrapUp: (id: string) => void;
};

export default function SessionSplitView({
  openSessionIds,
  sessions,
  boardExpanded,
  onToggleBoard,
  dismissedIds,
  onClose,
  onTerminate,
  onWrapUp,
}: SessionSplitViewProps) {
  if (openSessionIds.length === 0) return null;

  const openSessions = openSessionIds
    .map((id) => sessions.find((s) => s.session_id === id))
    .filter(Boolean) as DevinSession[];

  if (openSessions.length === 0) return null;

  return (
    <>
      {/* Toggle bar */}
      <button
        onClick={onToggleBoard}
        className="h-7 shrink-0 flex items-center justify-center gap-2 bg-t-border/50 hover:bg-t-border transition-colors"
      >
        <span className="text-[10px] font-medium text-t-text-muted">
          {boardExpanded ? "Hide Board" : "Show Board"}
        </span>
        <span className="text-[10px] text-t-text-muted">
          {boardExpanded ? "▼" : "▲"}
        </span>
      </button>

      {/* Panel area */}
      <div className="flex-1 flex overflow-hidden border-t border-t-border bg-t-bg min-h-0">
        {openSessions.map((session) => (
          <SessionPane
            key={session.session_id}
            session={session}
            isDismissed={dismissedIds.has(session.session_id)}
            onClose={onClose}
            onTerminate={onTerminate}
            onWrapUp={onWrapUp}
          />
        ))}
      </div>
    </>
  );
}
