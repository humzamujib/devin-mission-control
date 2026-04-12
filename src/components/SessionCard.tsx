"use client";

import type { DevinSession } from "@/types";

type SessionCardProps = {
  session: DevinSession;
  isOpen?: boolean;
  onClick: (session: DevinSession) => void;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusColors: Record<string, string> = {
  working: "bg-t-success",
  running: "bg-t-success",
  paused: "bg-t-warning",
  finished: "bg-t-info",
  stopped: "bg-t-error",
  blocked: "bg-t-warning",
};

export default function SessionCard({ session, isOpen, onClick }: SessionCardProps) {
  const title =
    session.structured_output?.title ||
    session.title ||
    `Session ${session.session_id.slice(0, 8)}`;
  const dotColor = statusColors[session.status_enum] || "bg-t-text-muted";

  return (
    <button
      onClick={() => onClick(session)}
      className={`w-full rounded-lg p-3 text-left transition-all ${
        isOpen
          ? "bg-t-primary/5 ring-1 ring-t-primary/40 shadow-sm"
          : "bg-t-surface shadow-sm hover:shadow-md hover:bg-t-surface-hover"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span className="text-xs font-medium uppercase tracking-wider text-t-text-muted">
            {session.status_enum}
          </span>
        </div>
        <span className="text-xs text-t-text-muted">
          {timeAgo(session.updated_at)}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium text-t-text line-clamp-2">
        {title}
      </p>
      {session.pull_request && (
        <span className="inline-block mt-1 rounded bg-t-border px-2 py-0.5 text-xs text-t-accent">
          PR #{session.pull_request.url.split("/").pop()}
        </span>
      )}
      {session.requesting_user_email && (
        <p className="mt-1 text-xs text-t-text-muted truncate">
          {session.requesting_user_email.split("@")[0]}
        </p>
      )}
    </button>
  );
}
