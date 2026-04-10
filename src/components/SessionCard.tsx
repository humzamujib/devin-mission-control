"use client";

import type { DevinSession } from "@/types";

type SessionCardProps = {
  session: DevinSession;
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
  working: "bg-emerald-500",
  running: "bg-emerald-500",
  paused: "bg-amber-500",
  finished: "bg-blue-500",
  stopped: "bg-red-500",
  blocked: "bg-orange-500",
};

export default function SessionCard({ session, onClick }: SessionCardProps) {
  const title =
    session.structured_output?.title ||
    session.title ||
    `Session ${session.session_id.slice(0, 8)}`;
  const dotColor = statusColors[session.status_enum] || "bg-zinc-500";

  return (
    <button
      onClick={() => onClick(session)}
      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800/70"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {session.status_enum}
          </span>
        </div>
        <span className="text-xs text-zinc-600">
          {timeAgo(session.updated_at)}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium text-zinc-200 line-clamp-2">
        {title}
      </p>
      {session.pull_request && (
        <span className="inline-block mt-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-indigo-400">
          PR #{session.pull_request.url.split("/").pop()}
        </span>
      )}
      {session.requesting_user_email && (
        <p className="mt-1 text-xs text-zinc-600 truncate">
          {session.requesting_user_email.split("@")[0]}
        </p>
      )}
    </button>
  );
}
