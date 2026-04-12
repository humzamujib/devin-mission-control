"use client";

import { useState, useEffect, useCallback } from "react";
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

type Tab = "sessions" | "knowledge" | "settings";

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
  const [boardExpanded, setBoardExpanded] = useState(true);

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

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
      setSessions(
        list.map((s: Record<string, unknown>) => normalizeSession(s))
      );
      setLastRefresh(new Date());
      setError(null);
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
    setOpenSessionIds((ids) =>
      ids.includes(session.session_id)
        ? ids
        : [...ids, session.session_id]
    );
  }

  function handleCloseSession(id: string) {
    setOpenSessionIds((ids) => ids.filter((i) => i !== id));
  }

  function handleTerminateSession(id: string) {
    handleCloseSession(id);
    fetchSessions();
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

  return (
    <div className="flex h-screen flex-col bg-t-bg text-t-text">
      <Header
        tab={tab}
        onTabChange={setTab}
        onCreateSession={() => setShowCreate(true)}
        onToggleLinear={() => setShowLinear((v) => !v)}
        sessionCount={
          sessions.filter(
            (s) => s.status_enum !== "finished" && s.status_enum !== "stopped"
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
          {(!hasOpenSessions || boardExpanded) && (
            <div className={`overflow-hidden ${hasOpenSessions ? "h-1/2 shrink-0" : "flex-1"}`}>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-t-text-muted">Loading sessions...</p>
                </div>
              ) : (
                <KanbanBoard
                  sessions={sessions}
                  openSessionIds={openSessionIds}
                  onSelectSession={handleOpenSession}
                />
              )}
            </div>
          )}
          <SessionSplitView
            openSessionIds={openSessionIds}
            sessions={sessions}
            boardExpanded={boardExpanded}
            onToggleBoard={() => setBoardExpanded((v) => !v)}
            onClose={handleCloseSession}
            onTerminate={handleTerminateSession}
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
