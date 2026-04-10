"use client";

type HeaderProps = {
  onCreateSession: () => void;
  onToggleLinear: () => void;
  sessionCount: number;
  lastRefresh: Date | null;
  onRefresh: () => void;
};

export default function Header({
  onCreateSession,
  onToggleLinear,
  sessionCount,
  lastRefresh,
  onRefresh,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Mission Control
        </h1>
        <span className="rounded-full bg-zinc-800 px-3 py-0.5 text-xs text-zinc-400">
          {sessionCount} sessions
        </span>
      </div>
      <div className="flex items-center gap-3">
        {lastRefresh && (
          <span className="text-xs text-zinc-500">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={onToggleLinear}
          className="rounded-lg border border-indigo-700/50 bg-indigo-950/30 px-3 py-1.5 text-sm text-indigo-300 transition-colors hover:bg-indigo-900/30"
        >
          Linear
        </button>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          Refresh
        </button>
        <button
          onClick={onCreateSession}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + New Session
        </button>
      </div>
    </header>
  );
}
