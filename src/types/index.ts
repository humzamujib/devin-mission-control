export type SessionStatus =
  | "working"
  | "running"
  | "paused"
  | "finished"
  | "stopped"
  | "blocked"
  | "expired"
  | "suspended"
  | "unknown";

export type KanbanColumnId = "queued" | "running" | "blocked" | "finished";

export type DevinSession = {
  session_id: string;
  title?: string;
  status: string;
  status_enum: SessionStatus;
  created_at: string;
  updated_at: string;
  url?: string;
  requesting_user_email?: string;
  tags?: string[];
  pull_request?: {
    url: string;
  } | null;
  structured_output?: {
    title?: string;
    summary?: string;
  } | null;
};

export type KanbanColumn = {
  id: KanbanColumnId;
  title: string;
  color: string;
  sessions: DevinSession[];
};

export type CreateSessionRequest = {
  prompt: string;
  playbook_id?: string;
};
