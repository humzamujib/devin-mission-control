export type ClaudeSessionStatus = "running" | "blocked" | "idle" | "done";

export type ClaudeMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

export type ClaudeSession = {
  id: string;
  title: string;
  repo: string;
  branch: string;
  status: ClaudeSessionStatus;
  created_at: string;
  updated_at: string;
  notes: string;
  pid?: number;
  cwd?: string;
  context?: string;
  messages?: ClaudeMessage[];
  source: "auto" | "manual";
};
