const VAULT_REPO = process.env.LINEAR_VAULT_REPO || "";
const API_BASE = `https://api.github.com/repos/${VAULT_REPO}/contents`;

function getHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function decodeContent(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf-8");
}

export type VaultFile = {
  name: string;
  path: string;
  content?: string;
};

export type PatternMeta = {
  name: string;
  path: string;
  tags: string[];
  repos: string[];
  confidence: string;
  last_referenced: string;
  reference_count: number;
  body: string;
};

function parseFrontmatter(content: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Parse arrays like ["a", "b"]
    if (val.startsWith("[")) {
      try {
        meta[key] = JSON.parse(val);
      } catch {
        meta[key] = val;
      }
    } else {
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = isNaN(Number(val)) ? val : Number(val);
    }
  }
  return { meta, body: match[2] };
}

export async function listDirectory(
  dirPath: string
): Promise<{ name: string; path: string }[]> {
  const res = await fetch(`${API_BASE}/${dirPath}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((f: { type: string }) => f.type === "file")
    .map((f: { name: string; path: string }) => ({
      name: f.name,
      path: f.path,
    }));
}

export async function readFile(filePath: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/${filePath}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return decodeContent(data.content);
}

export async function listPatterns(): Promise<PatternMeta[]> {
  const files = await listDirectory("patterns");
  const patterns: PatternMeta[] = [];

  for (const file of files) {
    const content = await readFile(file.path);
    if (!content) continue;
    const { meta, body } = parseFrontmatter(content);
    patterns.push({
      name: file.name.replace(/\.md$/, ""),
      path: file.path,
      tags: (meta.tags as string[]) || [],
      repos: (meta.repos as string[]) || [],
      confidence: (meta.confidence as string) || "unknown",
      last_referenced: (meta.last_referenced as string) || "",
      reference_count: (meta.reference_count as number) || 0,
      body,
    });
  }

  return patterns.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listChangelogs(
  limit = 10
): Promise<{ name: string; path: string }[]> {
  const files = await listDirectory("changelog");
  return files
    .filter((f) => f.name !== "instructions.md")
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, limit);
}

// === Session persistence ===

export type SessionRecord = {
  id: string;
  title: string;
  repo: string;
  prompt: string;
  result: string;
  status: string;
  source: string;
  model?: string;
  created_at: string;
  completed_at: string;
  duration_ms?: number;
  cost_usd?: number;
  tools_used?: string[];
  messages: { type: string; text: string; timestamp: string }[];
};

export async function writeSessionRecord(
  record: SessionRecord
): Promise<boolean> {
  const slug = record.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50);
  const date = record.completed_at.slice(0, 10);
  const filename = `${date}-${slug}.json`;
  const path = `sessions/${filename}`;
  const content = Buffer.from(JSON.stringify(record, null, 2)).toString(
    "base64"
  );

  const token = process.env.GITHUB_TOKEN;
  if (!token || !VAULT_REPO) return false;

  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "PUT",
      headers: {
        ...getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `session: ${record.title}`,
        content,
      }),
    });
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
}

export async function listSessionRecords(): Promise<SessionRecord[]> {
  const files = await listDirectory("sessions");
  const records: SessionRecord[] = [];

  for (const file of files.slice(0, 30)) {
    if (!file.name.endsWith(".json")) continue;
    const content = await readFile(file.path);
    if (!content) continue;
    try {
      records.push(JSON.parse(content));
    } catch {
      continue;
    }
  }

  return records.sort(
    (a, b) =>
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );
}
