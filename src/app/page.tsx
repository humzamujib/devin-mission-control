"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { DevinSession, BoardCard, KanbanColumnId } from "@/types";
import type { ClaudeSession } from "@/types/claude-session";
import { getStoredTheme, applyTheme, type ThemeId } from "@/lib/themes";
import {
  listClaudeSessions,
  updateClaudeSession,
} from "@/lib/claude-sessions";
import { usePageVisible } from "@/hooks/usePageVisible";
import type { SessionRecord } from "@/lib/vault";
import { getStoredModel, setStoredModel, getStoredEffort, setStoredEffort } from "@/lib/model-config";
import Header from "@/components/Header";
import KanbanBoard from "@/components/KanbanBoard";
import CreateSessionModal from "@/components/CreateSessionModal";
import SessionSplitView from "@/components/SessionSplitView";
import LinearPanel from "@/components/LinearPanel";
import KnowledgePanel from "@/components/KnowledgePanel";
import SettingsPanel from "@/components/SettingsPanel";
import VaultPanel from "@/components/VaultPanel";
import OrchestratorPanel from "@/components/OrchestratorPanel";
import VaultSessionDetailPanel from "@/components/VaultSessionDetailPanel";
import SessionDiagnostics from "@/components/SessionDiagnostics";

const POLL_INTERVAL = 30_000;
const USER_EMAIL = process.env.NEXT_PUBLIC_DEVIN_USER_EMAIL || "";

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

type Tab = "sessions" | "knowledge" | "vault" | "orchestrator" | "settings";
export type LayoutMode = "board" | "split" | "focus";

export default function Home() {
  const [tab, setTab] = useState<Tab>("sessions");
  const [theme, setTheme] = useState<ThemeId>("navy");
  const [devinSessions, setDevinSessions] = useState<DevinSession[]>([]);
  const [claudeSessions, setClaudeSessions] = useState<ClaudeSession[]>([]);
  const [vaultSessions, setVaultSessions] = useState<BoardCard[]>([]);
  const [vaultRecords, setVaultRecords] = useState<SessionRecord[]>([]);
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
  const [selectedVaultSessionId, setSelectedVaultSessionId] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState(() => getStoredModel());
  const [defaultEffort, setDefaultEffort] = useState(() => getStoredEffort());
  const [featureFlags, setFeatureFlags] = useState({ claudeEnabled: false, linearEnabled: false, vaultEnabled: false });
  const msgCountsRef = useRef<Record<string, number>>({});
  const pageVisible = usePageVisible();

  // Fetch feature flags once on mount
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setFeatureFlags)
      .catch(() => {});
  }, []);

  function handleModelChange(model: string) {
    setDefaultModel(model);
    setStoredModel(model);
  }

  function handleEffortChange(effort: string) {
    setDefaultEffort(effort);
    setStoredEffort(effort);
  }

  // Clear old manual sessions — auto-discovery handles everything now
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mc_claude_sessions");
    }
  }, []);

  const fetchClaudeSessions = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/local/claude-sessions", { signal });
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

      // Merge auto-discovered + SDK sessions
      // Fetch SDK session statuses
      let sdkSessions: ClaudeSession[] = [];
      try {
        const sdkRes = await fetch("/api/claude/sessions", { signal });
        const sdkData = await sdkRes.json();
        sdkSessions = (sdkData.sessions || []).map(
          (s: { id: string; repo: string; title: string; status: string; createdAt: string }) => ({
            id: s.id,
            title: s.title,
            repo: s.repo,
            branch: "",
            status: s.status === "waiting" ? "blocked" : s.status === "done" ? "done" : "running",
            created_at: s.createdAt,
            updated_at: new Date().toISOString(),
            notes: "",
            source: "auto" as const,
          })
        );
      } catch {}

      // Filter out auto-discovered sessions that match an SDK session's repo
      // or the orchestrator (runs in devin-mission-control)
      const sdkRepos = new Set(sdkSessions.map((s) => s.repo));
      sdkRepos.add("devin-mission-control");
      const filtered = discovered.filter((d) => !sdkRepos.has(d.repo));
      setClaudeSessions([...filtered, ...sdkSessions]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    const ac = new AbortController();
    fetchClaudeSessions(ac.signal);
    const interval = setInterval(() => fetchClaudeSessions(ac.signal), POLL_INTERVAL);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [fetchClaudeSessions, pageVisible]);

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

  // === Vault completed sessions ===
  useEffect(() => {
    if (!pageVisible) return;
    const ac = new AbortController();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const fetchVaultSessions = async () => {
      try {
        const res = await fetch("/api/vault/sessions", { signal: ac.signal });
        const data = await res.json();
        const allSessions: SessionRecord[] = data.sessions || [];
        setVaultRecords(allSessions);
        const cutoff = Date.now() - SEVEN_DAYS;
        const cards: BoardCard[] = allSessions
          .filter((s) => new Date(s.completed_at).getTime() > cutoff)
          .map((s) => ({
            id: `vault-${s.id}`,
            source: "claude" as const,
            title: s.title,
            subtitle: s.result?.slice(0, 80),
            status_display: "done",
            column: "finished" as const,
            updated_at: s.completed_at,
            requesting_user: s.repo,
          }));
        setVaultSessions(cards);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    };
    fetchVaultSessions();
    const interval = setInterval(fetchVaultSessions, 60_000);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [pageVisible]);

  // === Devin session management ===

  const fetchDevinSessions = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(
        `/api/devin/sessions?user_email=${encodeURIComponent(USER_EMAIL)}`,
        { signal }
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
        const currentSessionIds = new Set(normalized.map((s: DevinSession) => s.session_id));

        // Clean up dismissed sessions that no longer exist
        for (const dismissedId of next) {
          if (!currentSessionIds.has(dismissedId)) {
            next.delete(dismissedId);
          }
        }

        for (const s of normalized) {
          if (!next.has(s.session_id)) continue;

          // Always clear finished/stopped sessions from dismissed list after some time
          // This prevents permanent "idle" state for actually finished sessions
          if (s.status_enum === "finished" || s.status_enum === "stopped") {
            const sessionAge = Date.now() - new Date(s.updated_at).getTime();
            const oneHour = 60 * 60 * 1000;

            // Clear from dismissed list after 1 hour if with PR, immediately if no PR
            if (!s.pull_request || sessionAge > oneHour) {
              next.delete(s.session_id);
            }
            continue;
          }

          // Clear blocked sessions if they've been updated (new messages)
          if (s.status_enum === "blocked") {
            const prevTime = msgCountsRef.current[s.session_id];
            if (prevTime && s.updated_at !== prevTime) next.delete(s.session_id);
          }

          // Clear if session status changed from what it was when dismissed
          // This handles cases where terminated sessions come back to life
          if (s.status_enum === "running" || s.status_enum === "working") {
            const prevTime = msgCountsRef.current[s.session_id];
            if (prevTime && s.updated_at !== prevTime) next.delete(s.session_id);
          }
        }

        // Update message counts for comparison
        for (const s of normalized) {
          msgCountsRef.current[s.session_id] = s.updated_at;
        }

        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch sessions"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    const ac = new AbortController();

    fetchDevinSessions(ac.signal);
    const sessionInterval = setInterval(() => fetchDevinSessions(ac.signal), POLL_INTERVAL);

    return () => {
      ac.abort();
      clearInterval(sessionInterval);
    };
  }, [fetchDevinSessions, pageVisible]);

  // === Unified open/close ===

  function handleToggleCard(id: string) {
    // Handle vault sessions separately
    if (id.startsWith("vault-")) {
      setSelectedVaultSessionId(selectedVaultSessionId === id ? null : id);
      return;
    }

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

  async function handleCreateClaude(data: {
    title: string;
    repo: string;
    notes: string;
    model: string;
    effort: string;
  }) {
    const prompt = data.notes
      ? `${data.title}\n\n${data.notes}`
      : data.title;

    // Create an SDK session
    const res = await fetch("/api/claude/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, repo: data.repo, title: data.title, model: data.model, effort: data.effort }),
    });
    const { id } = await res.json();

    if (id) {
      // Add SDK session to claude sessions immediately
      const sdkSession: ClaudeSession = {
        id,
        title: data.title,
        repo: data.repo,
        branch: "",
        status: "running",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: "",
        source: "auto",
      };
      setClaudeSessions((prev) => [...prev, sdkSession]);

      // Open the pane
      setOpenIds((ids) => {
        if (ids.length === 0) setLayoutMode("split");
        return [...ids, id];
      });
    }
  }

  function handleUpdateClaude(id: string, updates: Partial<ClaudeSession>) {
    updateClaudeSession(id, updates);
    setClaudeSessions(listClaudeSessions());
  }


  // === Build unified board cards ===

  const boardCards: BoardCard[] = useMemo(() => {
    const devinCards: BoardCard[] = devinSessions.map((s) => {
      let column: KanbanColumnId;
      let status_display: string = s.status_enum;

      // Priority 1: PR status (enriched by the API route via GitHub)
      if (s.pull_request?.url && (s.pull_request.merged || s.pull_request.closed)) {
        column = "finished";
        status_display = "finished";
      } else if (s.pull_request?.url) {
        // Has open PR → needs attention
        column = "idle";
        status_display = "idle";
      }
      // Priority 2: Dismissed sessions go to idle
      else if (dismissedIds.has(s.session_id)) {
        column = "idle";
        status_display = "idle";
      }
      // Priority 3: Session status
      else {
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
            status_display = s.status_enum;
            break;
          default:
            column = "queued";
        }
      }

      return {
        id: s.session_id,
        source: "devin",
        title: s.title || `Session ${s.session_id.slice(0, 8)}`,
        status_display,
        column,
        updated_at: s.updated_at,
        pull_request_url: s.pull_request?.url,
        pull_request_merged: s.pull_request?.merged,
        pull_request_merged_at: s.pull_request?.merged_at,
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

    // Dedupe: don't show vault sessions that are still in the active claude list
    const activeIds = new Set(claudeCards.map((c) => c.id));
    const filteredVault = vaultSessions.filter((v) => !activeIds.has(v.id));

    return [...devinCards, ...claudeCards, ...filteredVault];
  }, [devinSessions, claudeSessions, dismissedIds, vaultSessions]);
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
        claudeEnabled={featureFlags.claudeEnabled}
        linearEnabled={featureFlags.linearEnabled}
        vaultEnabled={featureFlags.vaultEnabled}
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
            defaultModel={defaultModel}
            defaultEffort={defaultEffort}
            claudeEnabled={featureFlags.claudeEnabled}
          />
          {featureFlags.linearEnabled && (
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
          )}
        </>
      )}

      {tab === "knowledge" && <KnowledgePanel />}

      {tab === "vault" && featureFlags.vaultEnabled && <VaultPanel />}

      {tab === "orchestrator" && featureFlags.claudeEnabled && (
        <OrchestratorPanel
          defaultModel={defaultModel}
          defaultEffort={defaultEffort}
        />
      )}

      {tab === "settings" && (
        <SettingsPanel
          currentTheme={theme}
          onThemeChange={handleThemeChange}
          defaultModel={defaultModel}
          onModelChange={handleModelChange}
          defaultEffort={defaultEffort}
          onEffortChange={handleEffortChange}
          claudeEnabled={featureFlags.claudeEnabled}
        />
      )}

      {/* Vault Session Detail Panel */}
      <VaultSessionDetailPanel
        sessionId={selectedVaultSessionId}
        session={
          selectedVaultSessionId
            ? vaultRecords.find((r) => `vault-${r.id}` === selectedVaultSessionId) ?? null
            : null
        }
        onClose={() => setSelectedVaultSessionId(null)}
      />

      {/* Session Diagnostics - only on sessions tab */}
      {tab === "sessions" && (
        <SessionDiagnostics
          sessions={devinSessions}
          dismissedIds={dismissedIds}
          onRefresh={fetchDevinSessions}
          onTerminate={handleTerminateDevin}
          onWrapUp={handleWrapUpDevin}
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
  if (se === "working" || se === "in_progress")
    statusEnum = "working";
  else if (se.includes("run"))
    statusEnum = "running";
  else if (se.includes("pause") || se.includes("wait") || se.includes("suspend") || se.includes("sleep"))
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
