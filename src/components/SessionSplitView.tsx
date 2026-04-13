"use client";

import type { DevinSession } from "@/types";
import type { ClaudeSession } from "@/types/claude-session";
import type { LayoutMode } from "@/app/page";
import SessionPane from "./SessionPane";
import ClaudeSessionPane from "./ClaudeSessionPane";

type SessionSplitViewProps = {
  openIds: string[];
  devinSessions: DevinSession[];
  claudeSessions: ClaudeSession[];
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  dismissedIds: Set<string>;
  colorMap: Record<string, string>;
  onCloseDevin: (id: string) => void;
  onTerminateDevin: (id: string) => void;
  onWrapUpDevin: (id: string) => void;
  onCloseClaude: (id: string) => void;
  onUpdateClaude: (id: string, updates: Partial<ClaudeSession>) => void;
  onDeleteClaude: (id: string) => void;
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
  openIds,
  devinSessions,
  claudeSessions,
  layoutMode,
  onLayoutChange,
  dismissedIds,
  colorMap,
  onCloseDevin,
  onTerminateDevin,
  onWrapUpDevin,
  onCloseClaude,
  onUpdateClaude,
  onDeleteClaude,
}: SessionSplitViewProps) {
  if (openIds.length === 0) return null;

  const panes = openIds
    .map((id) => {
      const devin = devinSessions.find((s) => s.session_id === id);
      if (devin) return { type: "devin" as const, devin };
      const claude = claudeSessions.find((s) => s.id === id);
      if (claude) return { type: "claude" as const, claude };
      return null;
    })
    .filter(Boolean);

  if (panes.length === 0) return null;

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
                layoutMode === mode ? "bg-t-border" : "hover:bg-t-border/50"
              }`}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              <LayoutIcon mode={mode} active={layoutMode === mode} />
            </button>
          ))}
        </div>
        <span className="text-[10px] text-t-text-muted">
          {panes.length} session{panes.length !== 1 ? "s" : ""} open
        </span>
      </div>

      {/* Panel area */}
      {(layoutMode === "split" || layoutMode === "focus") && (
        <div className="flex-1 flex overflow-hidden bg-t-bg min-h-0">
          {panes.map((pane) => {
            if (!pane) return null;
            if (pane.type === "devin") {
              return (
                <SessionPane
                  key={pane.devin.session_id}
                  session={pane.devin}
                  isDismissed={dismissedIds.has(pane.devin.session_id)}
                  accentColor={colorMap[pane.devin.session_id]}
                  onClose={onCloseDevin}
                  onTerminate={onTerminateDevin}
                  onWrapUp={onWrapUpDevin}
                />
              );
            }
            return (
              <ClaudeSessionPane
                key={pane.claude.id}
                session={pane.claude}
                accentColor={colorMap[pane.claude.id]}
                onClose={onCloseClaude}
                onUpdate={onUpdateClaude}
                onDelete={onDeleteClaude}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
