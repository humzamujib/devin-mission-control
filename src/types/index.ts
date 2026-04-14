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

export type KanbanColumnId = "queued" | "running" | "blocked" | "idle" | "finished";

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
    merged?: boolean;
    closed?: boolean;
    merged_at?: string | null;
    merged_by?: string | null;
  } | null;
  structured_output?: {
    title?: string;
    summary?: string;
  } | null;
};

export type BoardCard = {
  id: string;
  source: "devin" | "claude";
  title: string;
  subtitle?: string;
  status_display: string;
  column: KanbanColumnId;
  updated_at: string;
  pull_request_url?: string;
  pull_request_merged?: boolean;
  pull_request_merged_at?: string | null;
  requesting_user?: string;
};

export type KanbanColumn = {
  id: KanbanColumnId;
  title: string;
  color: string;
  cards: BoardCard[];
};

export type CreateSessionRequest = {
  prompt: string;
  playbook_id?: string;
};
