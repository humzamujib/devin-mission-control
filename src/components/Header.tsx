"use client";

type Tab = "sessions" | "knowledge" | "settings";

type HeaderProps = {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onCreateSession: () => void;
  onToggleLinear: () => void;
  sessionCount: number;
  lastRefresh: Date | null;
  onRefresh: () => void;
};

export default function Header({
  tab,
  onTabChange,
  onCreateSession,
  onToggleLinear,
  sessionCount,
  lastRefresh,
  onRefresh,
}: HeaderProps) {
  return (
    <header className="border-b border-t-border bg-t-bg">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-t-text-bright tracking-tight">
            Mission Control
          </h1>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => onTabChange("sessions")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "sessions"
                  ? "bg-t-surface text-t-text-bright"
                  : "text-t-text-muted hover:text-t-text-secondary"
              }`}
            >
              Sessions
              <span className="ml-1.5 rounded-full bg-t-border px-1.5 py-0.5 text-[10px] text-t-text-secondary">
                {sessionCount}
              </span>
            </button>
            <button
              onClick={() => onTabChange("knowledge")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "knowledge"
                  ? "bg-t-surface text-t-text-bright"
                  : "text-t-text-muted hover:text-t-text-secondary"
              }`}
            >
              Knowledge
            </button>
            <button
              onClick={() => onTabChange("settings")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "settings"
                  ? "bg-t-surface text-t-text-bright"
                  : "text-t-text-muted hover:text-t-text-secondary"
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {tab === "sessions" && (
            <>
              {lastRefresh && (
                <span className="text-xs text-t-text-muted">
                  {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={onToggleLinear}
                className="rounded-lg border border-t-primary/40 bg-t-primary/10 px-3 py-1.5 text-sm text-t-accent-dim transition-colors hover:bg-t-primary/20"
              >
                Linear
              </button>
              <button
                onClick={onRefresh}
                className="rounded-lg border border-t-border px-3 py-1.5 text-sm text-t-text-secondary transition-colors hover:bg-t-surface"
              >
                Refresh
              </button>
              <button
                onClick={onCreateSession}
                className="rounded-lg bg-t-primary px-4 py-1.5 text-sm font-medium text-t-text-bright transition-colors hover:bg-t-primary-hover"
              >
                + New Session
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
