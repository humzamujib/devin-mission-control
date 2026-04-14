import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import { writeSessionRecord, writeChangelog, type SessionRecord } from "./vault";

const REPO_BASE_PATH = process.env.REPO_BASE_PATH || "~/Desktop";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", process.env.HOME || "");
  }
  return p;
}

export type ClaudeSdkMessage = {
  type: "assistant" | "user" | "tool" | "result" | "system" | "ask_user";
  text: string;
  timestamp: string;
  toolName?: string;
  sessionId?: string;
  questions?: unknown;
};

export type SdkSession = {
  id: string;
  query: Query;
  abort: AbortController;
  repo: string;
  title: string;
  status: "running" | "waiting" | "done";
  messages: ClaudeSdkMessage[];
  createdAt: string;
  sessionId: string | null;
};

// Server-side session store (lives in Node.js process memory)
const sessions = new Map<string, SdkSession>();

export function getSessions(): Map<string, SdkSession> {
  return sessions;
}

export function getSession(id: string): SdkSession | undefined {
  return sessions.get(id);
}

export function createSession(opts: {
  prompt: string;
  repo: string;
  title: string;
  model?: string;
  effort?: string;
}): string {
  const id = `sdk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const abort = new AbortController();
  const cwd = expandHome(`${REPO_BASE_PATH}/${opts.repo}`);

  const sdkOptions: Record<string, unknown> = {
    additionalDirectories: [cwd],
    model: opts.model || "claude-sonnet-4-20250514",
    tools: { type: "preset", preset: "claude_code" },
    permissionMode: "acceptEdits",
    abortController: abort,
    allowedTools: [
      "Read",
      "Edit",
      "Write",
      "Bash",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch",
    ],
  };

  if (opts.effort) {
    sdkOptions.effort = opts.effort;
  }

  const q = query({
    prompt: opts.prompt,
    options: sdkOptions as Parameters<typeof query>[0]["options"],
  });

  const session: SdkSession = {
    id,
    query: q,
    abort,
    repo: opts.repo,
    title: opts.title,
    status: "running",
    messages: [],
    createdAt: new Date().toISOString(),
    sessionId: null,
  };

  sessions.set(id, session);

  // Start consuming the generator in the background
  consumeSession(session);

  return id;
}

async function consumeSession(session: SdkSession) {
  try {
    for await (const msg of session.query) {
      const now = new Date().toISOString();

      if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
        session.sessionId = (msg as { session_id?: string }).session_id || null;
        continue;
      }

      if (msg.type === "assistant") {
        const assistantMsg = msg as {
          message?: { content?: unknown[] };
        };
        const content = assistantMsg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (
              typeof block === "object" &&
              block !== null &&
              "type" in block
            ) {
              const b = block as Record<string, unknown>;
              if (b.type === "text" && typeof b.text === "string") {
                session.messages.push({
                  type: "assistant",
                  text: b.text,
                  timestamp: now,
                });
              } else if (b.type === "tool_use") {
                const toolName = (b.name as string) || "unknown";
                const input = b.input
                  ? JSON.stringify(b.input).slice(0, 200)
                  : "";
                session.messages.push({
                  type: "tool",
                  text: input,
                  timestamp: now,
                  toolName,
                });

                // Detect AskUserQuestion
                if (toolName === "AskUserQuestion") {
                  session.status = "waiting";
                  session.messages.push({
                    type: "ask_user",
                    text: "",
                    timestamp: now,
                    questions: b.input,
                  });
                }
              }
            }
          }
        }
      }

      if (msg.type === "result") {
        const resultMsg = msg as {
          result?: string;
          subtype?: string;
          duration_ms?: number;
          total_cost_usd?: number;
        };
        session.status = "done";
        session.messages.push({
          type: "result",
          text: resultMsg.result || "Session ended",
          timestamp: now,
        });

        // Persist to vault
        const toolsUsed = new Set<string>();
        for (const m of session.messages) {
          if (m.type === "tool" && m.toolName) toolsUsed.add(m.toolName);
        }
        const record: SessionRecord = {
          id: session.id,
          title: session.title,
          repo: session.repo,
          prompt: session.messages.find((m) => m.type === "user")?.text || "",
          result: resultMsg.result || "",
          status: "done",
          source: "claude-sdk",
          created_at: session.createdAt,
          completed_at: now,
          duration_ms: resultMsg.duration_ms,
          cost_usd: resultMsg.total_cost_usd,
          tools_used: Array.from(toolsUsed),
          messages: session.messages.map((m) => ({
            type: m.type,
            text: m.text,
            timestamp: m.timestamp,
          })),
        };
        writeSessionRecord(record).catch((e) =>
          console.error("[sdk] Failed to write session record:", e)
        );

        // Write changelog entry
        const changelogBody = [
          `---`,
          `title: "${session.title}"`,
          `repo: "${session.repo}"`,
          `source: claude-sdk`,
          `date: "${now.slice(0, 10)}"`,
          `duration_ms: ${resultMsg.duration_ms || 0}`,
          `cost_usd: ${resultMsg.total_cost_usd || 0}`,
          `tools: [${Array.from(toolsUsed).map((t) => `"${t}"`).join(", ")}]`,
          `---`,
          ``,
          `## ${session.title}`,
          ``,
          `**Repo:** ${session.repo}`,
          `**Prompt:** ${session.messages.find((m) => m.type === "user")?.text?.slice(0, 200) || ""}`,
          ``,
          `### Result`,
          ``,
          resultMsg.result || "No result text",
        ].join("\n");
        writeChangelog(session.title, changelogBody).catch((e) =>
          console.error("[sdk] Failed to write changelog:", e)
        );
      }
    }
  } catch (err) {
    session.status = "done";
    session.messages.push({
      type: "result",
      text: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function respondToSession(
  id: string,
  message: string
): Promise<boolean> {
  const session = sessions.get(id);
  if (!session || !session.query) return false;

  session.status = "running";
  session.messages.push({
    type: "user",
    text: message,
    timestamp: new Date().toISOString(),
  });

  try {
    await session.query.streamInput(
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

export function stopSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.abort.abort();
  session.status = "done";
  return true;
}

export function deleteSession(id: string): boolean {
  const session = sessions.get(id);
  if (session && session.status !== "done") {
    session.abort.abort();
  }
  return sessions.delete(id);
}
