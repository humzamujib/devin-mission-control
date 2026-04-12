"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DevinSession } from "@/types";
import { getStoredTheme, applyTheme, type ThemeId } from "@/lib/themes";
import Header from "@/components/Header";
import KanbanBoard from "@/components/KanbanBoard";
import CreateSessionModal from "@/components/CreateSessionModal";
import SessionSplitView from "@/components/SessionSplitView";
import LinearPanel from "@/components/LinearPanel";
import KnowledgePanel from "@/components/KnowledgePanel";
import SettingsPanel from "@/components/SettingsPanel";

const POLL_INTERVAL = 15_000;
const USER_EMAIL = "humza.mujib@bilt.com";

const SESSION_COLORS = [
  "#2B6CB0", "#16794A", "#A16207", "#9333EA", "#DC2626", "#0891B2",
];

type Tab = "sessions" | "knowledge" | "settings";
export type LayoutMode = "board" | "split" | "focus";

export default function Home() {
  const [tab, setTab] = useState<Tab>("sessions");
  const [theme, setTheme] = useState<ThemeId>("navy");
  const [sessions, setSessions] = useState<DevinSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLinear, setShowLinear] = useState(false);
  const [createPrompt, setCreatePrompt] = useState("");
  const [openSessionIds, setOpenSessionIds] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("board");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("mc_dismissed_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const msgCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  // Persist dismissed IDs
  useEffect(() => {
    localStorage.setItem("mc_dismissed_ids", JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  function handleThemeChange(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
  }

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/devin/sessions?user_email=${encodeURIComponent(USER_EMAIL)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `API error: ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.sessions ?? [];
      const normalized = list.map((s: Record<string, unknown>) =>
        normalizeSession(s)
      );
      setSessions(normalized);
      setLastRefresh(new Date());
      setError(null);

      // Clean up dismissed IDs: remove sessions that actually finished,
      // and pop-back sessions where Devin replied (updated_at changed)
      setDismissedIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const s of normalized) {
          if (!next.has(s.session_id)) continue;
          // Session actually finished — remove from dismissed unless it has a PR
          if (s.status_enum === "finished" || s.status_enum === "stopped") {
            if (!s.pull_request) {
              next.delete(s.session_id);
            }
            continue;
          }
          // Pop-back: Devin replied while dismissed
          if (s.status_enum === "blocked") {
            const prevTime = msgCountsRef.current[s.session_id];
            const curTime = s.updated_at;
            if (prevTime && curTime !== prevTime) {
              next.delete(s.session_id);
            }
          }
        }
        for (const s of normalized) {
          msgCountsRef.current[s.session_id] = s.updated_at;
        }
        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch sessions"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  function handleOpenSession(session: DevinSession) {
    setOpenSessionIds((ids) => {
      if (ids.includes(session.session_id)) {
        // Toggle off
        const next = ids.filter((i) => i !== session.session_id);
        if (next.length === 0) setLayoutMode("board");
        return next;
      }
      // Toggle on
      if (ids.length === 0) setLayoutMode("split");
      return [...ids, session.session_id];
    });
  }

  function handleCloseSession(id: string) {
    setOpenSessionIds((ids) => {
      const next = ids.filter((i) => i !== id);
      if (next.length === 0) setLayoutMode("board");
      return next;
    });
  }

  function handleTerminateSession(id: string) {
    handleCloseSession(id);
    fetchSessions();
  }

  function handleWrapUp(id: string) {
    setDismissedIds((prev) => new Set([...prev, id]));
    handleCloseSession(id);
  }

  async function handleCreateSession(prompt: string) {
    await fetch("/api/devin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    fetchSessions();
  }

  async function handleLinearToDevin(prompt: string) {
    setShowLinear(false);
    await handleCreateSession(prompt);
  }

  const hasOpenSessions = openSessionIds.length > 0;
  const colorMap: Record<string, string> = {};
  openSessionIds.forEach((id, i) => {
    colorMap[id] = SESSION_COLORS[i % SESSION_COLORS.length];
  });

  return (
    <div className="flex h-screen flex-col bg-t-bg text-t-text">
      <Header
        tab={tab}
        onTabChange={setTab}
        onCreateSession={() => setShowCreate(true)}
        onToggleLinear={() => setShowLinear((v) => !v)}
        sessionCount={
          sessions.filter(
            (s) =>
              s.status_enum !== "finished" &&
              s.status_enum !== "stopped" &&
              !dismissedIds.has(s.session_id)
          ).length
        }
        lastRefresh={lastRefresh}
        onRefresh={fetchSessions}
      />

      {tab === "sessions" && (
        <>
          {error && (
            <div className="mx-6 mt-4 rounded-lg border border-t-error/30 bg-t-error/10 px-4 py-3 text-sm text-t-error">
              {error}
            </div>
          )}
          {(layoutMode === "board" || layoutMode === "split") && (
            <div className={`overflow-hidden ${layoutMode === "split" ? "h-1/2 shrink-0" : "flex-1"}`}>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-t-text-muted">Loading sessions...</p>
                </div>
              ) : (
                <KanbanBoard
                  sessions={sessions}
                  openSessionIds={openSessionIds}
                  dismissedIds={dismissedIds}
                  colorMap={colorMap}
                  onSelectSession={handleOpenSession}
                />
              )}
            </div>
          )}
          <SessionSplitView
            openSessionIds={openSessionIds}
            sessions={sessions}
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
            dismissedIds={dismissedIds}
            colorMap={colorMap}
            onClose={handleCloseSession}
            onTerminate={handleTerminateSession}
            onWrapUp={handleWrapUp}
          />
          <CreateSessionModal
            open={showCreate}
            onClose={() => {
              setShowCreate(false);
              setCreatePrompt("");
            }}
            onSubmit={handleCreateSession}
            initialPrompt={createPrompt}
          />
          <LinearPanel
            open={showLinear}
            onClose={() => setShowLinear(false)}
            onCreateSession={handleLinearToDevin}
            activeSessionTitles={sessions
              .filter((s) => s.status_enum !== "finished" && s.status_enum !== "stopped")
              .map((s) => s.title || "")}
          />
        </>
      )}

      {tab === "knowledge" && <KnowledgePanel />}

      {tab === "settings" && (
        <SettingsPanel
          currentTheme={theme}
          onThemeChange={handleThemeChange}
        />
      )}
    </div>
  );
}

function normalizeSession(raw: Record<string, unknown>): DevinSession {
  const status = (raw.status as string) || "unknown";
  const statusLower = status.toLowerCase();

  const apiStatusEnum = (raw.status_enum as string) || "";
  let statusEnum: DevinSession["status_enum"] = "unknown";
  const se = apiStatusEnum.toLowerCase() || statusLower;
  if (se === "working" || se.includes("run") || se === "in_progress")
    statusEnum = "working";
  else if (se.includes("pause") || se.includes("wait"))
    statusEnum = "paused";
  else if (se.includes("block")) statusEnum = "blocked";
  else if (
    se.includes("finish") ||
    se.includes("complete") ||
    se === "done" ||
    se === "stopped"
  )
    statusEnum = "finished";
  else if (se.includes("stop") || se.includes("fail"))
    statusEnum = "stopped";

  return {
    session_id: (raw.session_id as string) || (raw.devin_id as string) || "",
    title: raw.title as string | undefined,
    status,
    status_enum: statusEnum,
    created_at: (raw.created_at as string) || new Date().toISOString(),
    updated_at:
      (raw.updated_at as string) ||
      (raw.created_at as string) ||
      new Date().toISOString(),
    url: raw.url as string | undefined,
    requesting_user_email: raw.requesting_user_email as string | undefined,
    tags: raw.tags as string[] | undefined,
    pull_request: raw.pull_request as DevinSession["pull_request"],
    structured_output:
      raw.structured_output as DevinSession["structured_output"],
  };
}
