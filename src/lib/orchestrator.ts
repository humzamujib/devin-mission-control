import { query, type Query } from "@anthropic-ai/claude-agent-sdk";

import { createOrchestratorMcpServer } from "./orchestrator-tools";
import type { ClaudeSdkMessage } from "./claude-sdk";

const SYSTEM_PROMPT = `You are the orchestrator of Mission Control — a dashboard that manages Devin AI and Claude Code sessions for a software engineer.

You have access to custom tools:
- **get_board_state**: See all active Devin and Claude sessions with their statuses
- **get_session_history**: View completed session records from the vault
- **read_vault_file / list_vault_directory**: Browse the ai-vault (patterns, changelogs, session records)
- **write_vault_file**: Write session summaries or knowledge to the vault
- **create_devin_session**: Launch a new Devin AI session with a task
- **create_claude_session**: Spawn a new Claude SDK session in a specific repo
- **get_linear_tickets**: Get actionable Linear backlog tickets

Your job:
- Help the user manage their workflow across multiple AI agents
- Monitor session progress and flag issues when asked
- Suggest which tickets to work on next based on priority and context (when requested)
- Coordinate between Devin and Claude sessions
- Write session summaries and knowledge to the vault when asked
- Be concise and actionable in your responses

Note: The user can choose whether to automatically review board state and tickets when starting. If they didn't enable automatic review, only check these when explicitly asked to do so.`;

type UserMessageResolver = {
  resolve: (value: string) => void;
  promise: Promise<string>;
};

let orchestratorInstance: {
  query: Query;
  abort: AbortController;
  messages: ClaudeSdkMessage[];
  status: "running" | "waiting" | "done";
  sessionId: string | null;
  pendingInput: UserMessageResolver | null;
} | null = null;

function createPendingInput(): UserMessageResolver {
  let resolve: (value: string) => void;
  const promise = new Promise<string>((r) => {
    resolve = r;
  });
  return { resolve: resolve!, promise };
}

export function getOrchestrator() {
  return orchestratorInstance;
}

export function startOrchestrator(options: { reviewTickets?: boolean; model?: string; effort?: string } = {}): boolean {
  if (orchestratorInstance && orchestratorInstance.status !== "done") {
    return false;
  }

  const abort = new AbortController();
  const mcpServer = createOrchestratorMcpServer();

  // Create a user input stream that stays open for multi-turn
  const inputQueue: UserMessageResolver[] = [];

  async function* userInputStream() {
    // First message is the initial greeting prompt - conditional ticket review
    const initialMessage = options.reviewTickets
      ? "Hello! Please start by checking the current board state and linear tickets, then give me a summary of what's happening."
      : "Hello! I'm ready to help you manage your workflow across Devin and Claude sessions. How can I assist you today?";

    yield {
      type: "user" as const,
      parent_tool_use_id: null,
      message: {
        role: "user" as const,
        content: initialMessage,
      },
    };

    // Keep yielding user messages as they come in
    while (true) {
      const pending = createPendingInput();
      inputQueue.push(pending);
      if (orchestratorInstance) {
        orchestratorInstance.pendingInput = pending;
      }
      const message = await pending.promise;
      yield {
        type: "user" as const,
        parent_tool_use_id: null,
        message: {
          role: "user" as const,
          content: message,
        },
      };
    }
  }

  const sdkOptions: Record<string, unknown> = {
    model: options.model || "claude-sonnet-4-20250514",
    systemPrompt: SYSTEM_PROMPT,
    abortController: abort,
    permissionMode: "bypassPermissions",
    mcpServers: {
      "mission-control": mcpServer,
    },
  };

  if (options.effort) {
    sdkOptions.effort = options.effort;
  }

  const q = query({
    prompt: userInputStream(),
    options: sdkOptions as Parameters<typeof query>[0]["options"],
  });

  orchestratorInstance = {
    query: q,
    abort,
    messages: [],
    status: "running",
    sessionId: null,
    pendingInput: null,
  };

  consumeOrchestrator();
  return true;
}

async function consumeOrchestrator() {
  if (!orchestratorInstance) return;
  const orch = orchestratorInstance;

  try {
    for await (const msg of orch.query) {
      const now = new Date().toISOString();

      if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
        orch.sessionId = (msg as { session_id?: string }).session_id || null;
        continue;
      }

      if (msg.type === "assistant") {
        const assistantMsg = msg as { message?: { content?: unknown[] } };
        const content = assistantMsg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (typeof block === "object" && block !== null && "type" in block) {
              const b = block as Record<string, unknown>;
              if (b.type === "text" && typeof b.text === "string") {
                orch.messages.push({
                  type: "assistant",
                  text: b.text,
                  timestamp: now,
                });
                orch.status = "waiting";
              } else if (b.type === "tool_use") {
                orch.messages.push({
                  type: "tool",
                  text: JSON.stringify(b.input).slice(0, 200),
                  timestamp: now,
                  toolName: (b.name as string) || "unknown",
                });
              }
            }
          }
        }
      }

      if (msg.type === "result") {
        // Don't set to "done" — the orchestrator stays alive via the input stream
        orch.status = "waiting";
      }
    }
  } catch (err) {
    if (orch.status !== "done") {
      orch.status = "done";
      orch.messages.push({
        type: "result",
        text: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export async function sendToOrchestrator(message: string): Promise<boolean> {
  if (!orchestratorInstance || orchestratorInstance.status === "done") return false;

  orchestratorInstance.messages.push({
    type: "user",
    text: message,
    timestamp: new Date().toISOString(),
  });
  orchestratorInstance.status = "running";

  // Resolve the pending input promise so the generator yields the message
  if (orchestratorInstance.pendingInput) {
    orchestratorInstance.pendingInput.resolve(message);
    orchestratorInstance.pendingInput = null;
    return true;
  }

  // Fallback: use streamInput
  try {
    await orchestratorInstance.query.streamInput(
      (async function* () {
        yield {
          type: "user" as const,
          parent_tool_use_id: null,
          message: {
            role: "user" as const,
            content: message,
          },
        };
      })()
    );
    return true;
  } catch {
    return false;
  }
}

export function stopOrchestrator(): boolean {
  if (!orchestratorInstance) return false;
  orchestratorInstance.abort.abort();
  orchestratorInstance.status = "done";
  if (orchestratorInstance.pendingInput) {
    orchestratorInstance.pendingInput.resolve("__stop__");
  }
  return true;
}
