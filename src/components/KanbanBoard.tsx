"use client";

import { useState, useEffect, useMemo } from "react";
import type { BoardCard, KanbanColumn, KanbanColumnId } from "@/types";
import SessionCard from "./SessionCard";

type KanbanBoardProps = {
  cards: BoardCard[];
  openIds: string[];
  colorMap: Record<string, string>;
  onSelectCard: (id: string) => void;
};

const STORAGE_KEY = "mc_collapsed_columns";

const columns: { id: KanbanColumnId; title: string; dotColor: string }[] = [
  { id: "queued", title: "Queued", dotColor: "bg-t-text-muted" },
  { id: "running", title: "Running", dotColor: "bg-t-success" },
  { id: "blocked", title: "Needs Input", dotColor: "bg-t-warning" },
  { id: "idle", title: "Idle", dotColor: "bg-t-accent-dim" },
  { id: "finished", title: "Finished", dotColor: "bg-t-info" },
];

function groupCards(cards: BoardCard[]): KanbanColumn[] {
  const groups: Record<KanbanColumnId, BoardCard[]> = {
    queued: [],
    running: [],
    blocked: [],
    idle: [],
    finished: [],
  };

  for (const card of cards) {
    groups[card.column].push(card);
  }

  return columns.map((col) => ({
    ...col,
    color: col.dotColor,
    cards: groups[col.id].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
  }));
}

export default function KanbanBoard({
  cards,
  openIds,
  colorMap,
  onSelectCard,
}: KanbanBoardProps) {
  const kanbanColumns = useMemo(() => groupCards(cards), [cards]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  }, [collapsed]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto overflow-y-hidden p-6">
      {kanbanColumns.map((column) => {
        const isCollapsed = collapsed.has(column.id);
        const count = column.cards.length;

        if (isCollapsed) {
          return (
            <button
              key={column.id}
              onClick={() => toggleCollapse(column.id)}
              className="flex w-10 shrink-0 flex-col items-center rounded-xl bg-t-surface/60 py-3 transition-colors hover:bg-t-surface"
            >
              <span className={`h-2 w-2 rounded-full ${column.color} mb-2`} />
              <span className="[writing-mode:vertical-lr] text-xs font-semibold text-t-text-muted">
                {column.title}
              </span>
              {count > 0 && (
                <span className="mt-2 rounded-full bg-t-surface-hover px-1.5 py-0.5 text-[10px] text-t-text-muted">
                  {count}
                </span>
              )}
            </button>
          );
        }

        return (
          <div
            key={column.id}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-t-surface/60"
          >
            <button
              onClick={() => toggleCollapse(column.id)}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-t-surface-hover rounded-t-xl"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${column.color}`} />
                <h2 className="text-sm font-semibold text-t-text-secondary">
                  {column.title}
                </h2>
              </div>
              {column.id !== "finished" && column.id !== "idle" && (
                <span className="rounded-full bg-t-surface-hover px-2 py-0.5 text-xs text-t-text-muted">
                  {count}
                </span>
              )}
            </button>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
              {count === 0 ? (
                <p className="py-8 text-center text-xs text-t-text-muted">
                  No sessions
                </p>
              ) : (
                column.cards.map((card) => (
                  <SessionCard
                    key={card.id}
                    card={card}
                    isOpen={openIds.includes(card.id)}
                    accentColor={colorMap[card.id]}
                    onClick={() => onSelectCard(card.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
