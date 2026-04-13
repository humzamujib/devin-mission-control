"use client";

import type { BoardCard } from "@/types";

type SessionCardProps = {
  card: BoardCard;
  isOpen?: boolean;
  accentColor?: string;
  onClick: () => void;
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

export default function SessionCard({
  card,
  isOpen,
  accentColor,
  onClick,
}: SessionCardProps) {
  const sourceBadge =
    card.source === "claude"
      ? "bg-purple-500/15 text-purple-600"
      : "bg-t-success/15 text-t-success";

  return (
    <button
      onClick={onClick}
      style={
        isOpen && accentColor
          ? { borderLeftColor: accentColor }
          : undefined
      }
      className={`w-full rounded-lg p-3 text-left transition-all ${
        isOpen
          ? "border-l-[3px] bg-t-primary/5 shadow-sm"
          : "bg-t-surface shadow-sm hover:shadow-md hover:bg-t-surface-hover"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadge}`}
          >
            {card.source}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-t-text-muted">
            {card.status_display}
          </span>
        </div>
        <span className="text-[10px] text-t-text-muted">
          {timeAgo(card.updated_at)}
        </span>
      </div>
      <p className="mb-0.5 text-sm font-medium text-t-text line-clamp-1">
        {card.title}
      </p>
      {card.subtitle && (
        <p className="mb-1 text-[11px] text-t-text-muted line-clamp-1">
          {card.subtitle}
        </p>
      )}
      {card.pull_request_url && (
        <a
          href={card.pull_request_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 mt-1 rounded px-2 py-0.5 text-xs ${
            card.column === "idle"
              ? "bg-t-success/15 text-t-success font-medium"
              : "bg-t-border text-t-accent"
          }`}
        >
          {card.column === "idle" ? "PR ready" : "PR"} #
          {card.pull_request_url.split("/").pop()}
        </a>
      )}
      {card.requesting_user && (
        <p className="mt-1 text-[10px] text-t-text-muted truncate">
          {card.requesting_user}
        </p>
      )}
    </button>
  );
}
