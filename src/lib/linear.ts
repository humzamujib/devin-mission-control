export type LinearTicket = {
  id: string;
  title: string;
  status: string;
  priority: { value: number; name: string };
  labels: string[];
  team: string;
  project: string;
  url: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  description: string;
};

export type VaultExport = {
  exportedAt: string;
  assignee: string;
  totalCount: number;
  tickets: LinearTicket[];
};

const VAULT_API_URL =
  "https://api.github.com/repos/humzamujib/ai-vault/contents/linear/tickets.json";
const LINEAR_SYNC_PLAYBOOK = "playbook-d18aaca0c237457daaa651eb40677a8d";
const ACTIONABLE_STATUSES = ["Backlog"];

function getGitHubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function getDevinHeaders(): HeadersInit {
  const token = process.env.DEVIN_API_TOKEN;
  if (!token) throw new Error("DEVIN_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchTicketsFromVault(): Promise<{
  data: VaultExport | null;
  error?: string;
}> {
  try {
    const res = await fetch(VAULT_API_URL, {
      headers: getGitHubHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: null, error: `GitHub API error: ${res.status}` };
    }
    const json = await res.json();
    const content = Buffer.from(json.content, "base64").toString("utf-8");
    const parsed: VaultExport = JSON.parse(content);
    return { data: parsed };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch vault",
    };
  }
}

export function filterActionableTickets(tickets: LinearTicket[]): LinearTicket[] {
  return tickets.filter((t) => ACTIONABLE_STATUSES.includes(t.status));
}

export async function triggerLinearSync(): Promise<{
  session_id?: string;
  error?: string;
}> {
  try {
    const res = await fetch("https://api.devin.ai/v1/sessions", {
      method: "POST",
      headers: getDevinHeaders(),
      body: JSON.stringify({
        prompt: "Run the playbook",
        playbook_id: LINEAR_SYNC_PLAYBOOK,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.detail || `Devin API error: ${res.status}` };
    }
    return { session_id: data.session_id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to trigger sync",
    };
  }
}
