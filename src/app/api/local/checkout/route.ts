import { execSync } from "child_process";
import { NextRequest } from "next/server";

const REPO_BASE_PATH = process.env.REPO_BASE_PATH || "~/Desktop";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", process.env.HOME || "");
  }
  return p;
}

function parsePrUrl(
  url: string
): { owner: string; repo: string; number: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

async function getPrBranch(
  owner: string,
  repo: string,
  number: string
): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.head?.ref || null;
}

function getCurrentBranch(localPath: string): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: localPath,
      timeout: 5000,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// GET — check if branch is already checked out
export async function GET(request: NextRequest) {
  const prUrl = request.nextUrl.searchParams.get("pr_url");
  if (!prUrl) {
    return Response.json({ error: "Missing pr_url" }, { status: 400 });
  }

  const parsed = parsePrUrl(prUrl);
  if (!parsed) {
    return Response.json({ error: "Invalid PR URL" }, { status: 400 });
  }

  const branch = await getPrBranch(parsed.owner, parsed.repo, parsed.number);
  if (!branch) {
    return Response.json({ checked_out: false, branch: null });
  }

  const localPath = expandHome(`${REPO_BASE_PATH}/${parsed.repo}`);
  const currentBranch = getCurrentBranch(localPath);

  return Response.json({
    checked_out: currentBranch === branch,
    branch,
    current_branch: currentBranch,
    repo: parsed.repo,
  });
}

// POST — fetch + checkout + pull
export async function POST(request: NextRequest) {
  const { pr_url } = await request.json();
  if (!pr_url) {
    return Response.json(
      { success: false, error: "Missing pr_url" },
      { status: 400 }
    );
  }

  const parsed = parsePrUrl(pr_url);
  if (!parsed) {
    return Response.json(
      { success: false, error: "Invalid PR URL" },
      { status: 400 }
    );
  }

  const branch = await getPrBranch(parsed.owner, parsed.repo, parsed.number);
  if (!branch) {
    return Response.json(
      { success: false, error: "Could not determine branch" },
      { status: 502 }
    );
  }

  const localPath = expandHome(`${REPO_BASE_PATH}/${parsed.repo}`);

  // Already on this branch?
  const currentBranch = getCurrentBranch(localPath);
  if (currentBranch === branch) {
    // Just pull latest
    try {
      execSync(`git pull origin ${branch}`, {
        cwd: localPath,
        timeout: 30000,
      });
    } catch {
      // pull failed is non-fatal
    }
    return Response.json({
      success: true,
      branch,
      repo: parsed.repo,
      already_on_branch: true,
    });
  }

  try {
    execSync("git fetch origin", { cwd: localPath, timeout: 30000 });
    execSync(`git checkout ${branch}`, { cwd: localPath, timeout: 15000 });
    execSync(`git pull origin ${branch}`, { cwd: localPath, timeout: 30000 });

    return Response.json({ success: true, branch, repo: parsed.repo });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Git command failed";
    return Response.json(
      { success: false, error: message, branch, repo: parsed.repo },
      { status: 500 }
    );
  }
}
