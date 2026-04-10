"use client";

import { useState, useEffect, useCallback } from "react";
import type { DevinSession } from "@/types";
import Header from "@/components/Header";
import KanbanBoard from "@/components/KanbanBoard";
import CreateSessionModal from "@/components/CreateSessionModal";
import SessionDetailPanel from "@/components/SessionDetailPanel";
import LinearPanel from "@/components/LinearPanel";

const POLL_INTERVAL = 15_000;

export default function Home() {
  const [sessions, setSessions] = useState<DevinSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLinear, setShowLinear] = useState(false);
  const [createPrompt, setCreatePrompt] = useState("");
  const [selectedSession, setSelectedSession] = useState<DevinSession | null>(
    null
  );

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/devin/sessions");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `API error: ${res.status}`);
      }
      const data = await res.json();
      // The API returns { sessions: [...] } or could be an array directly
      const list = Array.isArray(data) ? data : data.sessions ?? [];
      setSessions(
        list.map((s: Record<string, unknown>) => normalizeSession(s))
      );
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  async function handleCreateSession(prompt: string) {
    await fetch("/api/devin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    fetchSessions();
  }

  function handleLinearToDevin(prompt: string) {
    setCreatePrompt(prompt);
    setShowLinear(false);
    setShowCreate(true);
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header
        onCreateSession={() => setShowCreate(true)}
        onToggleLinear={() => setShowLinear((v) => !v)}
        sessionCount={sessions.length}
        lastRefresh={lastRefresh}
        onRefresh={fetchSessions}
      />
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-zinc-500">Loading sessions...</p>
        </div>
      ) : (
        <KanbanBoard
          sessions={sessions}
          onSelectSession={setSelectedSession}
        />
      )}
      <CreateSessionModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreatePrompt("");
        }}
        onSubmit={handleCreateSession}
        initialPrompt={createPrompt}
      />
      <SessionDetailPanel
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        onTerminate={() => {
          setSelectedSession(null);
          fetchSessions();
        }}
      />
      <LinearPanel
        open={showLinear}
        onClose={() => setShowLinear(false)}
        onSendToDevin={handleLinearToDevin}
      />
    </div>
  );
}

function normalizeSession(raw: Record<string, unknown>): DevinSession {
  const status = (raw.status as string) || "unknown";
  const statusLower = status.toLowerCase();

  // Use the API's status_enum directly if available, otherwise derive from status
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
    structured_output: raw.structured_output as DevinSession["structured_output"],
  };
}
