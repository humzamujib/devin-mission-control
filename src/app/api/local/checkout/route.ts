import { execSync } from "child_process";
import { NextRequest } from "next/server";

const REPO_BASE_PATH = process.env.REPO_BASE_PATH || "~/Desktop";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", process.env.HOME || "");
  }
  return p;
}

function parsePrUrl(url: string): { owner: string; repo: string; number: string } | null {
  // https://github.com/owner/repo/pull/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

export async function POST(request: NextRequest) {
  const { pr_url } = await request.json();
  if (!pr_url) {
    return Response.json({ success: false, error: "Missing pr_url" }, { status: 400 });
  }

  const parsed = parsePrUrl(pr_url);
  if (!parsed) {
    return Response.json({ success: false, error: "Invalid PR URL" }, { status: 400 });
  }

  // Get branch name from GitHub API
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const ghRes = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
    { headers }
  );

  if (!ghRes.ok) {
    return Response.json(
      { success: false, error: `GitHub API error: ${ghRes.status}` },
      { status: 502 }
    );
  }

  const prData = await ghRes.json();
  const branch = prData.head?.ref;
  if (!branch) {
    return Response.json(
      { success: false, error: "Could not determine branch name" },
      { status: 500 }
    );
  }

  const localPath = expandHome(`${REPO_BASE_PATH}/${parsed.repo}`);

  try {
    execSync(`git fetch origin`, { cwd: localPath, timeout: 30000 });
    execSync(`git checkout ${branch}`, { cwd: localPath, timeout: 15000 });
    execSync(`git pull origin ${branch}`, { cwd: localPath, timeout: 30000 });

    return Response.json({
      success: true,
      branch,
      repo: parsed.repo,
      path: localPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Git command failed";
    return Response.json({ success: false, error: message, branch, repo: parsed.repo }, { status: 500 });
  }
}
