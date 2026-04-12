"use client";

import type { DevinSession } from "@/types";
import type { LayoutMode } from "@/app/page";
import SessionPane from "./SessionPane";

type SessionSplitViewProps = {
  openSessionIds: string[];
  sessions: DevinSession[];
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  dismissedIds: Set<string>;
  colorMap: Record<string, string>;
  onClose: (id: string) => void;
  onTerminate: (id: string) => void;
  onWrapUp: (id: string) => void;
};

function LayoutIcon({
  mode,
  active,
}: {
  mode: LayoutMode;
  active: boolean;
}) {
  const base = active ? "bg-t-text-secondary" : "bg-t-text-muted/40";
  const dim = active ? "bg-t-text-secondary/40" : "bg-t-text-muted/20";
  return (
    <div className="flex flex-col gap-[2px] w-4 h-3.5">
      {mode === "board" && (
        <>
          <div className={`flex-[3] rounded-[1px] ${base}`} />
          <div className={`flex-[1] rounded-[1px] ${dim}`} />
        </>
      )}
      {mode === "split" && (
        <>
          <div className={`flex-1 rounded-[1px] ${base}`} />
          <div className={`flex-1 rounded-[1px] ${base}`} />
        </>
      )}
      {mode === "focus" && (
        <>
          <div className={`flex-[1] rounded-[1px] ${dim}`} />
          <div className={`flex-[3] rounded-[1px] ${base}`} />
        </>
      )}
    </div>
  );
}

export default function SessionSplitView({
  openSessionIds,
  sessions,
  layoutMode,
  onLayoutChange,
  dismissedIds,
  colorMap,
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
      {/* Layout bar */}
      <div className="h-8 shrink-0 flex items-center justify-between px-4 bg-t-surface-hover/50 border-y border-t-border/50">
        <div className="flex items-center gap-1">
          {(["board", "split", "focus"] as LayoutMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onLayoutChange(mode)}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === mode
                  ? "bg-t-border"
                  : "hover:bg-t-border/50"
              }`}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              <LayoutIcon mode={mode} active={layoutMode === mode} />
            </button>
          ))}
        </div>
        <span className="text-[10px] text-t-text-muted">
          {openSessions.length} session{openSessions.length !== 1 ? "s" : ""} open
        </span>
      </div>

      {/* Panel area */}
      {(layoutMode === "split" || layoutMode === "focus") && (
        <div className="flex-1 flex overflow-hidden bg-t-bg min-h-0">
          {openSessions.map((session) => (
            <SessionPane
              key={session.session_id}
              session={session}
              isDismissed={dismissedIds.has(session.session_id)}
              accentColor={colorMap[session.session_id]}
              onClose={onClose}
              onTerminate={onTerminate}
              onWrapUp={onWrapUp}
            />
          ))}
        </div>
      )}
    </>
  );
}
