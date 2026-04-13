import { execSync } from "child_process";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME || "";
const CLAUDE_PROJECTS_DIR = join(HOME, ".claude", "projects");

type MessageEntry = {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

type SessionState = "running" | "idle" | "needs_input";

type DiscoveredSession = {
  pid: number;
  cwd: string;
  repo: string;
  started_at: string;
  context: string;
  state: SessionState;
  messages: MessageEntry[];
};

type ProcessInfo = { pid: number; cwd: string; started: string; hasChildren: boolean };

function getClaudeProcesses(): ProcessInfo[] {
  try {
    // Match claude CLI processes, not Ghostty, Claude.app, or launcher scripts
    const psOut = execSync(
      "ps -eo pid,lstart,command | grep -v grep | grep -v Ghostty | grep -v Claude.app | grep -v mc-claude | grep -v '/usr/bin/login' | grep -E '\\bclaude( |$)'",
      { timeout: 5000 }
    )
      .toString()
      .trim();

    if (!psOut) return [];

    const seen = new Map<string, ProcessInfo>();

    for (const line of psOut.split("\n")) {
      const trimmed = line.trim();
      const pid = parseInt(trimmed.split(/\s+/)[0]);
      if (!pid || isNaN(pid)) continue;

      const match = trimmed.match(/^\s*\d+\s+(.+?)\s+(?:\/.*\/)?claude/);
      const started = match ? match[1].trim() : "";

      let cwd = "";
      try {
        const lsofOut = execSync(`lsof -p ${pid} 2>/dev/null | grep cwd`, {
          timeout: 5000,
        }).toString();
        const cwdMatch = lsofOut.match(/\s(\/\S+)$/m);
        if (cwdMatch) cwd = cwdMatch[1];
      } catch {}

      if (!cwd) continue;

      // Check if process has active children (Claude is working vs waiting for input)
      let hasChildren = false;
      try {
        const pgrepOut = execSync(`pgrep -P ${pid}`, { timeout: 3000 }).toString().trim();
        hasChildren = pgrepOut.length > 0;
      } catch {
        // pgrep returns exit code 1 when no children found
      }

      // Deduplicate by cwd — keep the most recent PID
      const existing = seen.get(cwd);
      if (!existing || pid > existing.pid) {
        seen.set(cwd, { pid, cwd, started, hasChildren });
      }
    }

    return Array.from(seen.values());
  } catch {
    return [];
  }
}

function getProjectDir(cwd: string): string {
  const encoded = cwd.replace(/[/.]/g, "-");
  return join(CLAUDE_PROJECTS_DIR, encoded);
}

const IDLE_THRESHOLD_MS = 30_000; // 30s = idle (Claude finished, brief pause)
const NEEDS_INPUT_THRESHOLD_MS = 5 * 60_000; // 5min = genuinely waiting for you

function readSessionMessages(cwd: string): {
  context: string;
  messages: MessageEntry[];
  fileAge: number;
  lastStopIsEndTurn: boolean;
} {
  const projectDir = getProjectDir(cwd);
  const result = {
    context: "",
    messages: [] as MessageEntry[],
    fileAge: 0,
    lastStopIsEndTurn: false,
  };

  try {
    const files = readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({
        name: f,
        mtime: statSync(join(projectDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return result;

    const fileAge = Date.now() - files[0].mtime;
    const content = readFileSync(join(projectDir, files[0].name), "utf-8");
    const lines = content.split("\n").filter(Boolean);

    let lastAssistantStop = "";

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message;
        if (!msg || !msg.role) continue;

        const role = msg.role as "user" | "assistant";
        const stopReason = msg.stop_reason || "";
        const contentBlocks = Array.isArray(msg.content) ? msg.content : [];

        if (role === "assistant" && stopReason) lastAssistantStop = stopReason;

        // Extract only human-readable text
        let text = "";
        let hasOnlyTools = true;

        for (const block of contentBlocks) {
          if (block.type === "text" && block.text) {
            text += block.text;
            hasOnlyTools = false;
          } else if (block.type === "tool_use" || block.type === "tool_result") {
            // Skip tool blocks
          } else if (block.type === "thinking") {
            // Skip thinking blocks
          }
        }

        if (typeof msg.content === "string") {
          text = msg.content;
          hasOnlyTools = false;
        }

        if (!text || hasOnlyTools) continue;

        // Set context from first real user message
        if (role === "user" && !result.context) {
          result.context = text.slice(0, 300);
        }

        result.messages.push({
          role,
          text: text.slice(0, 2000),
          timestamp: entry.timestamp || "",
        });
      } catch {
        continue;
      }
    }

    result.fileAge = fileAge;
    result.lastStopIsEndTurn = lastAssistantStop === "end_turn";
  } catch {}

  return result;
}

export async function GET() {
  const processes = getClaudeProcesses();

  const sessions: DiscoveredSession[] = processes.map((p: ProcessInfo) => {
    const sessionData = readSessionMessages(p.cwd);
    const { context, messages, fileAge, lastStopIsEndTurn } = sessionData;

    // Check if the JSONL predates this process (stale from a previous session)
    const processStartMs = p.started
      ? new Date(p.started).getTime()
      : Date.now();
    const fileModifiedAt = Date.now() - fileAge;
    const isStaleFile = fileModifiedAt < processStartMs - 60_000; // file older than process by >1min

    // Determine state:
    // - running: actively working, or new session that hasn't written yet, or stale file from old session
    // - idle: finished a turn, brief pause (no children, stale <5min)
    // - needs_input: genuinely waiting for user (no children, stale >5min)
    let state: SessionState = "running";
    if (
      !isStaleFile &&
      !p.hasChildren &&
      lastStopIsEndTurn &&
      fileAge > IDLE_THRESHOLD_MS
    ) {
      state =
        fileAge > NEEDS_INPUT_THRESHOLD_MS ? "needs_input" : "idle";
    }

    return {
      pid: p.pid,
      cwd: p.cwd,
      repo: p.cwd.split("/").pop() || p.cwd,
      started_at: p.started
        ? new Date(p.started).toISOString()
        : new Date().toISOString(),
      context: isStaleFile ? "" : context,
      state,
      messages: isStaleFile ? [] : messages,
    };
  });

  return Response.json({ sessions });
}
