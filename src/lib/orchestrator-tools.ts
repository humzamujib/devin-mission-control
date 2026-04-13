import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readFile, listDirectory, listSessionRecords, writeSessionRecord } from "./vault";
import { getSessions, createSession as createClaudeSession, stopSession as stopClaudeSession } from "./claude-sdk";

// Vault tools

const readVaultFile = tool(
  "read_vault_file",
  "Read a file from the ai-vault repository",
  { path: z.string().describe("File path relative to vault root, e.g. 'patterns/styling.md'") },
  async ({ path }) => {
    const content = await readFile(path);
    return {
      content: [{ type: "text" as const, text: content || "File not found" }],
    };
  }
);

const listVaultDir = tool(
  "list_vault_directory",
  "List files in a vault directory",
  { path: z.string().describe("Directory path, e.g. 'patterns', 'changelog', 'sessions'") },
  async ({ path }) => {
    const files = await listDirectory(path);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(files, null, 2) }],
    };
  }
);

const writeVaultFile = tool(
  "write_vault_file",
  "Write a session record to the vault",
  {
    title: z.string(),
    content: z.string().describe("JSON content to write"),
  },
  async ({ title, content }) => {
    try {
      const record = JSON.parse(content);
      const success = await writeSessionRecord(record);
      return {
        content: [{ type: "text" as const, text: success ? "Written successfully" : "Failed to write" }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err}` }],
      };
    }
  }
);

// Board state tools

const getBoardState = tool(
  "get_board_state",
  "Get the current state of all sessions on the Kanban board (Devin + Claude)",
  {},
  async () => {
    // Fetch Devin sessions
    const devinToken = process.env.DEVIN_API_TOKEN;
    const userEmail = process.env.NEXT_PUBLIC_DEVIN_USER_EMAIL || "";
    let devinSessions: unknown[] = [];
    if (devinToken) {
      try {
        const res = await fetch(
          `https://api.devin.ai/v1/sessions?limit=100&user_email=${encodeURIComponent(userEmail)}`,
          { headers: { Authorization: `Bearer ${devinToken}` } }
        );
        const data = await res.json();
        devinSessions = (data.sessions || []).map((s: Record<string, unknown>) => ({
          id: s.session_id,
          source: "devin",
          title: s.title,
          status: s.status_enum,
          pr: (s.pull_request as Record<string, string>)?.url,
        }));
      } catch {}
    }

    // Get Claude SDK sessions
    const claudeSessions = Array.from(getSessions().values()).map((s) => ({
      id: s.id,
      source: "claude-sdk",
      title: s.title,
      status: s.status,
      repo: s.repo,
    }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ devin: devinSessions, claude: claudeSessions }, null, 2),
      }],
    };
  }
);

const getSessionHistory = tool(
  "get_session_history",
  "Get completed session records from the vault",
  { limit: z.number().default(10) },
  async ({ limit }) => {
    const records = await listSessionRecords();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(records.slice(0, limit), null, 2),
      }],
    };
  }
);

// Session creation tools

const createDevinSession = tool(
  "create_devin_session",
  "Create a new Devin AI session with a task prompt",
  { prompt: z.string().describe("Task description for Devin") },
  async ({ prompt }) => {
    const token = process.env.DEVIN_API_TOKEN;
    if (!token) {
      return { content: [{ type: "text" as const, text: "DEVIN_API_TOKEN not set" }] };
    }
    try {
      const res = await fetch("https://api.devin.ai/v1/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      return {
        content: [{
          type: "text" as const,
          text: `Devin session created: ${data.session_id || "unknown"}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err}` }] };
    }
  }
);

const spawnClaudeSession = tool(
  "create_claude_session",
  "Spawn a new Claude SDK session to work on a task in a specific repo",
  {
    prompt: z.string().describe("Task description"),
    repo: z.string().describe("Repository name, e.g. 'bilt-frontend'"),
    title: z.string().describe("Short title for the session"),
  },
  async ({ prompt, repo, title }) => {
    const id = createClaudeSession({ prompt, repo, title });
    return {
      content: [{ type: "text" as const, text: `Claude session created: ${id}` }],
    };
  }
);

// Stop tools

const stopClaude = tool(
  "stop_claude_session",
  "Stop/abort a running Claude SDK session",
  { id: z.string().describe("Session ID, e.g. 'sdk-1776059...'") },
  async ({ id }) => {
    const success = stopClaudeSession(id);
    return {
      content: [{
        type: "text" as const,
        text: success ? `Claude session ${id} stopped` : `Session ${id} not found`,
      }],
    };
  }
);

const stopDevin = tool(
  "stop_devin_session",
  "Terminate a running Devin session",
  { id: z.string().describe("Devin session ID") },
  async ({ id }) => {
    const token = process.env.DEVIN_API_TOKEN;
    if (!token) {
      return { content: [{ type: "text" as const, text: "DEVIN_API_TOKEN not set" }] };
    }
    try {
      const res = await fetch(`https://api.devin.ai/v1/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return {
        content: [{ type: "text" as const, text: `Devin session terminated: ${data.detail || "ok"}` }],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err}` }] };
    }
  }
);

// Linear tools

const getLinearTickets = tool(
  "get_linear_tickets",
  "Get actionable Linear tickets from the vault",
  {},
  async () => {
    const content = await readFile("linear/tickets.json");
    if (!content) {
      return { content: [{ type: "text" as const, text: "No tickets found" }] };
    }
    try {
      const data = JSON.parse(content);
      const backlog = data.tickets.filter((t: Record<string, string>) => t.status === "Backlog");
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            backlog.map((t: Record<string, unknown>) => ({
              id: t.id,
              title: t.title,
              priority: (t.priority as Record<string, string>)?.name,
              team: t.team,
              url: t.url,
            })),
            null,
            2
          ),
        }],
      };
    } catch {
      return { content: [{ type: "text" as const, text: "Failed to parse tickets" }] };
    }
  }
);

export function createOrchestratorMcpServer() {
  return createSdkMcpServer({
    name: "mission-control",
    version: "1.0.0",
    tools: [
      readVaultFile,
      listVaultDir,
      writeVaultFile,
      getBoardState,
      getSessionHistory,
      createDevinSession,
      spawnClaudeSession,
      stopClaude,
      stopDevin,
      getLinearTickets,
    ],
  });
}
