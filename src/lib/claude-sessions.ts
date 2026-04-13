import type { ClaudeSession, ClaudeSessionStatus } from "@/types/claude-session";

const STORAGE_KEY = "mc_claude_sessions";

function generateId(): string {
  return `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listClaudeSessions(): ClaudeSession[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function save(sessions: ClaudeSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function createClaudeSession(data: {
  title: string;
  repo: string;
  branch?: string;
  notes?: string;
}): ClaudeSession {
  const now = new Date().toISOString();
  const session: ClaudeSession = {
    id: generateId(),
    title: data.title,
    repo: data.repo,
    branch: data.branch || "",
    status: "running",
    created_at: now,
    updated_at: now,
    notes: data.notes || "",
    source: "manual",
  };
  const sessions = listClaudeSessions();
  sessions.unshift(session);
  save(sessions);
  return session;
}

export function updateClaudeSession(
  id: string,
  updates: Partial<Pick<ClaudeSession, "title" | "status" | "notes" | "branch">>
): ClaudeSession | null {
  const sessions = listClaudeSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sessions[idx] = {
    ...sessions[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  save(sessions);
  return sessions[idx];
}

export function deleteClaudeSession(id: string): boolean {
  const sessions = listClaudeSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  if (filtered.length === sessions.length) return false;
  save(filtered);
  return true;
}

export function updateClaudeSessionStatus(
  id: string,
  status: ClaudeSessionStatus
): ClaudeSession | null {
  return updateClaudeSession(id, { status });
}
