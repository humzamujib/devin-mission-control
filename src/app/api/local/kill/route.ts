import { execSync } from "child_process";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { pid, cwd } = await request.json();

  // If cwd provided, kill ALL claude processes in that directory
  if (cwd) {
    try {
      const psOut = execSync(
        "ps -eo pid,command | grep -E '\\bclaude$' | grep -v grep",
        { timeout: 5000 }
      )
        .toString()
        .trim();

      const pids: number[] = [];
      for (const line of psOut.split("\n")) {
        const p = parseInt(line.trim());
        if (!p || isNaN(p)) continue;
        try {
          const lsofOut = execSync(`lsof -p ${p} 2>/dev/null | grep cwd`, {
            timeout: 5000,
          }).toString();
          const cwdMatch = lsofOut.match(/\s(\/\S+)$/m);
          if (cwdMatch && cwdMatch[1] === cwd) pids.push(p);
        } catch {}
      }

      if (pids.length === 0) {
        return Response.json({ success: false, error: "No processes found" }, { status: 404 });
      }

      execSync(`kill ${pids.join(" ")}`, { timeout: 5000 });
      return Response.json({ success: true, killed: pids });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kill failed";
      return Response.json({ success: false, error: message }, { status: 500 });
    }
  }

  // Fallback: kill single PID
  if (!pid || typeof pid !== "number") {
    return Response.json({ success: false, error: "Missing pid or cwd" }, { status: 400 });
  }

  try {
    const check = execSync(`ps -p ${pid} -o command=`, { timeout: 5000 })
      .toString()
      .trim();
    if (!check.endsWith("claude")) {
      return Response.json(
        { success: false, error: "PID is not a claude process" },
        { status: 403 }
      );
    }
    execSync(`kill ${pid}`, { timeout: 5000 });
    return Response.json({ success: true, killed: [pid] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kill failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
