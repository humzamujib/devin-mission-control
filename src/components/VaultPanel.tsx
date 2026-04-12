"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type PatternMeta = {
  name: string;
  path: string;
  tags: string[];
  repos: string[];
  confidence: string;
  last_referenced: string;
  reference_count: number;
  body: string;
};

type ChangelogEntry = {
  name: string;
  path: string;
};

const confidenceColors: Record<string, string> = {
  high: "bg-t-success/15 text-t-success",
  medium: "bg-t-warning/15 text-t-warning",
  low: "bg-t-error/15 text-t-error",
};

type Section = "patterns" | "changelogs" | "health";

export default function VaultPanel() {
  const [patterns, setPatterns] = useState<PatternMeta[]>([]);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [vaultIndex, setVaultIndex] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [expandedChangelog, setExpandedChangelog] = useState<string | null>(null);
  const [changelogContent, setChangelogContent] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<Section>>(
    new Set(["patterns", "changelogs", "health"])
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/vault/patterns").then((r) => r.json()),
      fetch("/api/vault/changelogs").then((r) => r.json()),
      fetch("/api/vault/index").then((r) => r.json()),
    ]).then(([pData, cData, iData]) => {
      setPatterns(pData.patterns || []);
      setChangelogs(cData.changelogs || []);
      setVaultIndex(iData.content || null);
      setLoading(false);
    });
  }, []);

  function toggleSection(s: Section) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function handleExpandChangelog(name: string) {
    if (expandedChangelog === name) {
      setExpandedChangelog(null);
      setChangelogContent(null);
      return;
    }
    setExpandedChangelog(name);
    setChangelogContent(null);
    const res = await fetch(`/api/vault/changelogs?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    setChangelogContent(data.content || "Failed to load");
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-t-text-muted">Loading vault...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl p-6">
        <h2 className="mb-6 text-lg font-semibold text-t-text-bright">
          Vault
        </h2>

        {/* Patterns */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection("patterns")}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-t-text-secondary"
          >
            <span className="text-[10px]">
              {openSections.has("patterns") ? "v" : ">"}
            </span>
            Patterns
            <span className="rounded-full bg-t-surface-hover px-2 py-0.5 text-[10px] text-t-text-muted">
              {patterns.length}
            </span>
          </button>
          {openSections.has("patterns") && (
            <div className="flex flex-col gap-2">
              {patterns.map((p) => {
                const isExpanded = expandedPattern === p.name;
                return (
                  <div
                    key={p.name}
                    className="rounded-lg bg-t-surface shadow-sm"
                  >
                    <button
                      onClick={() =>
                        setExpandedPattern(isExpanded ? null : p.name)
                      }
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        isExpanded
                          ? "rounded-t-lg"
                          : "rounded-lg hover:bg-t-surface-hover"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-t-text">
                            {p.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              confidenceColors[p.confidence] ||
                              "bg-t-text-muted/15 text-t-text-muted"
                            }`}
                          >
                            {p.confidence}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-t-text-muted">
                          <span>{p.reference_count} refs</span>
                          {p.last_referenced && (
                            <span>last {p.last_referenced}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-t-primary/10 px-1.5 py-0.5 text-[10px] text-t-primary"
                          >
                            {t}
                          </span>
                        ))}
                        {p.repos.map((r) => (
                          <span
                            key={r}
                            className="rounded bg-t-accent-dim/10 px-1.5 py-0.5 text-[10px] text-t-accent-dim"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-t-border px-4 py-3">
                        <div className="prose-messages text-xs text-t-text">
                          <ReactMarkdown>{p.body}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Changelogs */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection("changelogs")}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-t-text-secondary"
          >
            <span className="text-[10px]">
              {openSections.has("changelogs") ? "v" : ">"}
            </span>
            Recent Changelogs
            <span className="rounded-full bg-t-surface-hover px-2 py-0.5 text-[10px] text-t-text-muted">
              {changelogs.length}
            </span>
          </button>
          {openSections.has("changelogs") && (
            <div className="flex flex-col gap-1">
              {changelogs.map((c) => {
                const isExpanded = expandedChangelog === c.name;
                return (
                  <div
                    key={c.name}
                    className="rounded-lg bg-t-surface shadow-sm"
                  >
                    <button
                      onClick={() => handleExpandChangelog(c.name)}
                      className={`w-full px-4 py-2.5 text-left text-sm text-t-text transition-colors ${
                        isExpanded
                          ? "rounded-t-lg"
                          : "rounded-lg hover:bg-t-surface-hover"
                      }`}
                    >
                      {c.name.replace(/\.md$/, "")}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-t-border px-4 py-3">
                        {changelogContent ? (
                          <div className="prose-messages text-xs text-t-text">
                            <ReactMarkdown>{changelogContent}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-xs text-t-text-muted">
                            Loading...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Vault Health */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection("health")}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-t-text-secondary"
          >
            <span className="text-[10px]">
              {openSections.has("health") ? "v" : ">"}
            </span>
            Vault Health
          </button>
          {openSections.has("health") && vaultIndex && (
            <div className="rounded-lg bg-t-surface p-4 shadow-sm">
              <div className="prose-messages text-xs text-t-text">
                <ReactMarkdown>{vaultIndex}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
