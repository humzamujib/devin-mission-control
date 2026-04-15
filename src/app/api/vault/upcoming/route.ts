import { listChangelogs, readFile } from "@/lib/vault";
import type { NextRequest } from "next/server";

// Private function to write to vault (mirrored from vault.ts)
async function writeVaultFile(
  path: string,
  content: string,
  commitMessage: string
): Promise<boolean> {
  const VAULT_REPO = process.env.LINEAR_VAULT_REPO || "";
  const API_BASE = `https://api.github.com/repos/${VAULT_REPO}/contents`;

  function getHeaders(): HeadersInit {
    const token = process.env.GITHUB_TOKEN;
    const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token || !VAULT_REPO) {
    console.error("[vault] Missing GITHUB_TOKEN or VAULT_REPO");
    return false;
  }

  const encoded = Buffer.from(content).toString("base64");

  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "PUT",
      headers: {
        ...getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
      }),
    });
    if (!res.ok && res.status !== 201) {
      const err = await res.text();
      console.error(`[vault] Write failed (${res.status}): ${err.slice(0, 200)}`);
      return false;
    }
    console.log(`[vault] Wrote ${path}`);
    return true;
  } catch (err) {
    console.error(`[vault] Write error:`, err);
    return false;
  }
}

function extractUpcomingItems(content: string): string[] {
  const upcomingItems: string[] = [];

  // Look for sections that contain upcoming/next steps content
  const upcomingPatterns = [
    /### Upcoming\s*\n([\s\S]*?)(?=\n### |\n## |\n---|\n\n\n|$)/gi,
    /## Upcoming\s*\n([\s\S]*?)(?=\n### |\n## |\n---|\n\n\n|$)/gi,
    /### Next Steps\s*\n([\s\S]*?)(?=\n### |\n## |\n---|\n\n\n|$)/gi,
    /## Next Steps\s*\n([\s\S]*?)(?=\n### |\n## |\n---|\n\n\n|$)/gi,
    /### Action Plan\s*\n([\s\S]*?)(?=\n### |\n## |\n---|\n\n\n|$)/gi,
    /### Immediate Action Plan\s*\n([\s\S]*?)(?=\n### |\n## |\n---|\n\n\n|$)/gi,
  ];

  for (const pattern of upcomingPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const sectionContent = match[1].trim();

      // Extract bullet points and numbered items
      const lines = sectionContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => line.match(/^[-*+•]\s+|^\d+\.\s+/))
        .map(line => line.replace(/^[-*+•]\s+|^\d+\.\s+/, ''))
        .filter(line => line.length > 0);

      upcomingItems.push(...lines);
    }
  }

  return upcomingItems;
}

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

export async function GET() {
  try {
    // Read the upcoming.md file if it exists
    const content = await readFile("upcoming.md");
    if (!content) {
      return Response.json({ error: "Upcoming file not found" }, { status: 404 });
    }
    return Response.json({ content });
  } catch (error) {
    console.error("Error reading upcoming file:", error);
    return Response.json({ error: "Failed to read upcoming file" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { regenerate } = body;

    if (!regenerate) {
      return Response.json({ error: "Missing regenerate flag" }, { status: 400 });
    }

    console.log("[vault] Regenerating upcoming.md from all changelogs...");

    // Get all changelogs (not limited)
    const changelogs = await listChangelogs(100);
    console.log(`[vault] Found ${changelogs.length} changelogs to process`);

    const upcomingByRepo: Record<string, Array<{ item: string; source: string; date: string }>> = {};

    // Process each changelog
    for (const changelog of changelogs) {
      const content = await readFile(changelog.path);
      if (!content) continue;

      const { meta, body } = parseFrontmatter(content);
      const upcomingItems = extractUpcomingItems(body);

      if (upcomingItems.length > 0) {
        const repo = (meta.repo as string) || (meta.source as string) || 'general';
        const date = (meta.date as string) || changelog.name.slice(0, 10);
        const sourceName = changelog.name.replace(/\.md$/, '');

        if (!upcomingByRepo[repo]) {
          upcomingByRepo[repo] = [];
        }

        upcomingItems.forEach(item => {
          upcomingByRepo[repo].push({
            item,
            source: sourceName,
            date
          });
        });

        console.log(`[vault] Found ${upcomingItems.length} upcoming items in ${sourceName}`);
      }
    }

    // Generate the upcoming.md content
    const now = new Date().toISOString();
    let upcomingContent = `---
title: "Upcoming Work & Next Steps"
generated_at: "${now}"
source: "vault-aggregation"
description: "Aggregated upcoming work items from all changelog entries"
---

# Upcoming Work & Next Steps

*This file is automatically generated from all changelog entries. Last updated: ${new Date().toLocaleDateString()}*

`;

    // Sort repos and add sections
    const sortedRepos = Object.keys(upcomingByRepo).sort();

    if (sortedRepos.length === 0) {
      upcomingContent += `
## No Upcoming Items Found

No upcoming work items were found in the current changelogs. This could mean:
- All planned work has been completed
- Upcoming work is tracked in other systems (Linear, etc.)
- Changelogs need to be updated with next steps

`;
    } else {
      for (const repo of sortedRepos) {
        const items = upcomingByRepo[repo];
        upcomingContent += `
## ${repo}

`;

        // Group by date and sort by newest first
        const itemsByDate = items.reduce((acc, { item, source, date }) => {
          if (!acc[date]) acc[date] = [];
          acc[date].push({ item, source });
          return acc;
        }, {} as Record<string, Array<{ item: string; source: string }>>);

        const sortedDates = Object.keys(itemsByDate).sort().reverse();

        for (const date of sortedDates) {
          const dateItems = itemsByDate[date];
          upcomingContent += `### From ${date}\n\n`;

          for (const { item, source } of dateItems) {
            upcomingContent += `- ${item}\n  *Source: ${source}*\n\n`;
          }
        }
      }
    }

    upcomingContent += `
---

*This file is automatically generated by scanning all changelog entries for "Upcoming", "Next Steps", and "Action Plan" sections. To update this file, run the vault upcoming regeneration API or update the source changelogs.*
`;

    // Write the upcoming.md file to vault
    const success = await writeVaultFile(
      "upcoming.md",
      upcomingContent,
      "Auto-generate upcoming work aggregation from changelogs"
    );

    if (success) {
      console.log("[vault] Successfully generated upcoming.md");
      return Response.json({
        success: true,
        message: "Upcoming file regenerated successfully",
        itemsFound: Object.values(upcomingByRepo).flat().length,
        reposProcessed: sortedRepos.length
      });
    } else {
      return Response.json({ error: "Failed to write upcoming file to vault" }, { status: 500 });
    }

  } catch (error) {
    console.error("Error generating upcoming file:", error);
    return Response.json({ error: "Failed to generate upcoming file" }, { status: 500 });
  }
}