"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { DevinSession, BoardCard, KanbanColumnId } from "@/types";
import type { ClaudeSession } from "@/types/claude-session";
import { getStoredTheme, applyTheme, type ThemeId } from "@/lib/themes";
import {
  listClaudeSessions,
  createClaudeSession,
  updateClaudeSession,
  deleteClaudeSession,
} from "@/lib/claude-sessions";
import Header from "@/components/Header";
import KanbanBoard from "@/components/KanbanBoard";
import CreateSessionModal from "@/components/CreateSessionModal";
import SessionSplitView from "@/components/SessionSplitView";
import LinearPanel from "@/components/LinearPanel";
import KnowledgePanel from "@/components/KnowledgePanel";
import SettingsPanel from "@/components/SettingsPanel";
import VaultPanel from "@/components/VaultPanel";

const POLL_INTERVAL = 15_000;
const USER_EMAIL = process.env.NEXT_PUBLIC_DEVIN_USER_EMAIL || "";
const REPO_BASE = process.env.NEXT_PUBLIC_REPO_BASE_PATH || "~/Desktop";

const SESSION_COLORS = [
  "#2B6CB0", "#16794A", "#A16207", "#9333EA", "#DC2626", "#0891B2",
];

// Known repos for the Claude session form
const KNOWN_REPOS = [
  "bilt-frontend",
  "bilt-mobile",
  "bilt-equinox-svc",
  "enterprise-pos-mobile",
  "devin-mission-control",
];

type Tab = "sessions" | "knowledge" | "vault" | "settings";
export type LayoutMode = "board" | "split" | "focus";

export default function Home() {
  const [tab, setTab] = useState<Tab>("sessions");
  const [theme, setTheme] = useState<ThemeId>("navy");
  const [devinSessions, setDevinSessions] = useState<DevinSession[]>([]);
  const [claudeSessions, setClaudeSessions] = useState<ClaudeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLinear, setShowLinear] = useState(false);
  const [createPrompt, setCreatePrompt] = useState("");
  const [openIds, setOpenIds] = useState<string[]>([]);
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

  // Clear old manual sessions — auto-discovery handles everything now
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mc_claude_sessions");
    }
  }, []);

  const fetchClaudeSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/local/claude-sessions");
      if (!res.ok) return;
      const data = await res.json();
      const discovered: ClaudeSession[] = (data.sessions || []).map(
        (s: { pid: number; cwd: string; repo: string; started_at: string; context: string; state: string; messages: { role: string; text: string; timestamp: string }[] }) => ({
          id: `claude-auto-${s.cwd.replace(/[/.]/g, "-")}`,
          title: s.repo,
          repo: s.repo,
          branch: "",
          status: (s.state === "needs_input" ? "blocked" : s.state === "idle" ? "idle" : "running") as ClaudeSession["status"],
          created_at: s.started_at,
          updated_at: new Date().toISOString(),
          notes: "",
          pid: s.pid,
          cwd: s.cwd,
          context: s.context,
          messages: s.messages,
          source: "auto" as const,
        })
      );

      setClaudeSessions(discovered);
    } catch {
      // Local API unavailable
    }
  }, []);

  useEffect(() => {
    fetchClaudeSessions();
    const interval = setInterval(fetchClaudeSessions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchClaudeSessions]);

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("mc_dismissed_ids", JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  function handleThemeChange(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
  }

  // === Devin session management ===

  const fetchDevinSessions = useCallback(async () => {
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
      setDevinSessions(normalized);
      setLastRefresh(new Date());
      setError(null);

      setDismissedIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const s of normalized) {
          if (!next.has(s.session_id)) continue;
          if (s.status_enum === "finished" || s.status_enum === "stopped") {
            if (!s.pull_request) next.delete(s.session_id);
            continue;
          }
          if (s.status_enum === "blocked") {
            const prevTime = msgCountsRef.current[s.session_id];
            if (prevTime && s.updated_at !== prevTime) next.delete(s.session_id);
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
    fetchDevinSessions();
    const interval = setInterval(fetchDevinSessions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDevinSessions]);

  // === Unified open/close ===

  function handleToggleCard(id: string) {
    setOpenIds((ids) => {
      if (ids.includes(id)) {
        const next = ids.filter((i) => i !== id);
        if (next.length === 0) setLayoutMode("board");
        return next;
      }
      if (ids.length === 0) setLayoutMode("split");
      return [...ids, id];
    });
  }

  function handleClosePane(id: string) {
    setOpenIds((ids) => {
      const next = ids.filter((i) => i !== id);
      if (next.length === 0) setLayoutMode("board");
      return next;
    });
  }

  // === Devin actions ===

  function handleTerminateDevin(id: string) {
    handleClosePane(id);
    fetchDevinSessions();
  }

  function handleWrapUpDevin(id: string) {
    setDismissedIds((prev) => new Set([...prev, id]));
    handleClosePane(id);
  }

  async function handleCreateDevin(prompt: string) {
    await fetch("/api/devin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    fetchDevinSessions();
  }

  async function handleLinearToDevin(prompt: string) {
    setShowLinear(false);
    await handleCreateDevin(prompt);
  }

  // === Claude actions ===

  function handleCreateClaude(data: {
    title: string;
    repo: string;
    notes: string;
  }) {
    // Launch claude with the prompt — auto-discovery picks it up on next poll
    const prompt = data.notes
      ? `${data.title}\n\n${data.notes}`
      : data.title;
    fetch("/api/local/launch-claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: data.repo, prompt }),
    });
    // Trigger an immediate poll to pick up the new session
    setTimeout(fetchClaudeSessions, 3000);
  }

  function handleUpdateClaude(id: string, updates: Partial<ClaudeSession>) {
    updateClaudeSession(id, updates);
    setClaudeSessions(listClaudeSessions());
  }

  function handleDeleteClaude(id: string) {
    deleteClaudeSession(id);
    setClaudeSessions(listClaudeSessions());
    handleClosePane(id);
  }

  // === Build unified board cards ===

  const boardCards: BoardCard[] = useMemo(() => {
    const devinCards: BoardCard[] = devinSessions.map((s) => {
      let column: KanbanColumnId;
      if (dismissedIds.has(s.session_id)) {
        column = "idle";
      } else {
        switch (s.status_enum) {
          case "working":
          case "running":
            column = "running";
            break;
          case "paused":
          case "blocked":
            column = "blocked";
            break;
          case "finished":
          case "stopped":
            column = "finished";
            break;
          default:
            column = "queued";
        }
      }
      return {
        id: s.session_id,
        source: "devin",
        title: s.title || `Session ${s.session_id.slice(0, 8)}`,
        status_display: dismissedIds.has(s.session_id) ? "idle" : s.status_enum,
        column,
        updated_at: s.updated_at,
        pull_request_url: s.pull_request?.url,
        requesting_user: s.requesting_user_email?.split("@")[0],
      };
    });

    const claudeCards: BoardCard[] = claudeSessions.map((s) => ({
      id: s.id,
      source: "claude",
      title: s.title,
      subtitle: s.context,
      status_display: s.status,
      column:
        s.status === "running"
          ? "running"
          : s.status === "blocked"
            ? "blocked"
            : s.status === "idle"
              ? "idle"
              : "finished",
      updated_at: s.updated_at,
      requesting_user: s.repo,
    }));

    return [...devinCards, ...claudeCards];
  }, [devinSessions, claudeSessions, dismissedIds]);

  const hasOpenPanes = openIds.length > 0;
  const colorMap: Record<string, string> = {};
  openIds.forEach((id, i) => {
    colorMap[id] = SESSION_COLORS[i % SESSION_COLORS.length];
  });

  const activeCount = boardCards.filter(
    (c) => c.column !== "finished" && c.column !== "idle"
  ).length;

  return (
    <div className="flex h-screen flex-col bg-t-bg text-t-text">
      <Header
        tab={tab}
        onTabChange={setTab}
        onCreateSession={() => setShowCreate(true)}
        onToggleLinear={() => setShowLinear((v) => !v)}
        sessionCount={activeCount}
        lastRefresh={lastRefresh}
        onRefresh={fetchDevinSessions}
      />

      {tab === "sessions" && (
        <>
          {error && (
            <div className="mx-6 mt-4 rounded-lg border border-t-error/30 bg-t-error/10 px-4 py-3 text-sm text-t-error">
              {error}
            </div>
          )}
          {(layoutMode === "board" || layoutMode === "split") && (
            <div
              className={`overflow-hidden ${layoutMode === "split" ? "h-1/2 shrink-0" : "flex-1"}`}
            >
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-t-text-muted">Loading sessions...</p>
                </div>
              ) : (
                <KanbanBoard
                  cards={boardCards}
                  openIds={openIds}
                  colorMap={colorMap}
                  onSelectCard={handleToggleCard}
                />
              )}
            </div>
          )}
          <SessionSplitView
            openIds={openIds}
            devinSessions={devinSessions}
            claudeSessions={claudeSessions}
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
            dismissedIds={dismissedIds}
            colorMap={colorMap}
            onCloseDevin={handleClosePane}
            onTerminateDevin={handleTerminateDevin}
            onWrapUpDevin={handleWrapUpDevin}
            onCloseClaude={handleClosePane}
            onUpdateClaude={handleUpdateClaude}
            onDeleteClaude={handleDeleteClaude}
          />
          <CreateSessionModal
            open={showCreate}
            onClose={() => {
              setShowCreate(false);
              setCreatePrompt("");
            }}
            onSubmitDevin={handleCreateDevin}
            onSubmitClaude={handleCreateClaude}
            initialPrompt={createPrompt}
            repos={KNOWN_REPOS}
          />
          <LinearPanel
            open={showLinear}
            onClose={() => setShowLinear(false)}
            onCreateSession={handleLinearToDevin}
            activeSessionTitles={devinSessions
              .filter(
                (s) =>
                  (s.status_enum !== "finished" &&
                    s.status_enum !== "stopped") ||
                  s.pull_request
              )
              .map((s) => s.title || "")}
          />
        </>
      )}

      {tab === "knowledge" && <KnowledgePanel />}

      {tab === "vault" && <VaultPanel />}

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
