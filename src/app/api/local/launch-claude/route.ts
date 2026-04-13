import { execSync, exec } from "child_process";
import { writeFileSync, chmodSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { NextRequest } from "next/server";

const REPO_BASE_PATH = process.env.REPO_BASE_PATH || "~/Desktop";
const TERMINAL_APP = process.env.TERMINAL_APP || "Ghostty";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", process.env.HOME || "");
  }
  return p;
}

function focusTerminal(): boolean {
  try {
    execSync(
      `osascript -e 'tell application "${TERMINAL_APP}" to activate'`,
      { timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const { repo, pid, prompt } = await request.json();

  // If there's a running session, just focus the terminal
  if (pid) {
    focusTerminal();
    return Response.json({ success: true, method: "focus" });
  }

  if (!repo) {
    return Response.json(
      { success: false, error: "Missing repo" },
      { status: 400 }
    );
  }

  const localPath = expandHome(`${REPO_BASE_PATH}/${repo}`);

  // Write a temp launcher script
  const scriptPath = join(tmpdir(), `mc-claude-${Date.now()}.sh`);
  const escapedPrompt = prompt
    ? ` "${prompt.replace(/"/g, '\\"').slice(0, 1000)}"`
    : "";
  writeFileSync(
    scriptPath,
    `#!/bin/zsh\ncd "${localPath}" && claude${escapedPrompt}\n`
  );
  chmodSync(scriptPath, "755");

  // Clean up script after a delay
  setTimeout(() => {
    try { unlinkSync(scriptPath); } catch {}
  }, 10000);

  return new Promise<Response>((resolve) => {
    if (TERMINAL_APP === "Ghostty") {
      exec(
        `open -na Ghostty.app --args -e "${scriptPath}"`,
        { timeout: 10000 },
        (err) => {
          if (err) {
            resolve(
              Response.json({ success: false, error: err.message }, { status: 500 })
            );
          } else {
            resolve(Response.json({ success: true, method: "ghostty" }));
          }
        }
      );
    } else {
      exec(
        `osascript -e 'tell application "Terminal" to do script "${scriptPath}"'`,
        { timeout: 10000 },
        (err) => {
          if (err) {
            resolve(
              Response.json({ success: false, error: err.message }, { status: 500 })
            );
          } else {
            resolve(Response.json({ success: true, method: "terminal" }));
          }
        }
      );
    }
  });
}
