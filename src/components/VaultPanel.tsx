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
  source?: string;
  date?: string;
  repo?: string;
};

const confidenceColors: Record<string, string> = {
  high: "bg-t-success/15 text-t-success",
  medium: "bg-t-warning/15 text-t-warning",
  low: "bg-t-error/15 text-t-error",
};

const sourceColors: Record<string, string> = {
  "claude-code": "bg-blue-500/10 text-blue-600",
  "claude-sdk": "bg-blue-500/10 text-blue-600",
  "devin": "bg-purple-500/10 text-purple-600",
  "auto": "bg-green-500/10 text-green-600",
  "manual": "bg-gray-500/10 text-gray-600",
};

type Section = "upcoming" | "patterns" | "changelogs" | "health" | "orchestrator";

export default function VaultPanel() {
  const [patterns, setPatterns] = useState<PatternMeta[]>([]);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [vaultIndex, setVaultIndex] = useState<string | null>(null);
  const [upcomingContent, setUpcomingContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [expandedChangelog, setExpandedChangelog] = useState<string | null>(null);
  const [changelogContent, setChangelogContent] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<Section>>(
    new Set(["upcoming", "patterns", "changelogs", "health", "orchestrator"])
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/vault/patterns").then((r) => r.json()),
      fetch("/api/vault/changelogs").then((r) => r.json()),
      fetch("/api/vault/index").then((r) => r.json()),
      fetch("/api/vault/upcoming").then((r) => r.json().catch(() => ({ content: null }))),
    ]).then(([pData, cData, iData, uData]) => {
      setPatterns(pData.patterns || []);
      setChangelogs(cData.changelogs || []);
      setVaultIndex(iData.content || null);
      setUpcomingContent(uData.content || null);
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
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
    return { meta, body: match[2] };
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

  function getChangelogMetadata(changelog: ChangelogEntry) {
    // Extract date from filename (YYYY-MM-DD format)
    const dateMatch = changelog.name.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';

    // Try to infer source from filename or path
    let source = 'general';
    if (changelog.name.includes('claude')) source = 'claude-code';
    else if (changelog.name.includes('devin')) source = 'devin';
    else if (changelog.name.includes('auto')) source = 'auto';

    return { date, source };
  }

  function groupChangelogsByDate(changelogs: ChangelogEntry[]) {
    const groups: { [key: string]: ChangelogEntry[] } = {};
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    changelogs.forEach(changelog => {
      const { date } = getChangelogMetadata(changelog);
      if (!date) {
        if (!groups['Other']) groups['Other'] = [];
        groups['Other'].push(changelog);
        return;
      }

      const changelogDate = new Date(date);
      const isToday = changelogDate.toDateString() === today.toDateString();
      const isThisWeek = changelogDate >= oneWeekAgo;

      let groupKey: string;
      if (isToday) {
        groupKey = 'Today';
      } else if (isThisWeek) {
        groupKey = 'This Week';
      } else {
        groupKey = 'Older';
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(changelog);
    });

    return groups;
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

        {/* Upcoming Work */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection("upcoming")}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-t-text-secondary"
          >
            <span className="text-[10px]">
              {openSections.has("upcoming") ? "v" : ">"}
            </span>
            Upcoming Work & Next Steps
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600">
              Auto-Generated
            </span>
          </button>
          {openSections.has("upcoming") && (
            <div className="rounded-lg bg-t-surface shadow-sm">
              {upcomingContent ? (
                <div className="p-4">
                  <div className="prose-messages text-sm text-t-text">
                    <ReactMarkdown>{upcomingContent}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm text-t-text-muted mb-3">
                    No upcoming work items found. The upcoming.md file might not exist yet.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/vault/upcoming", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ regenerate: true }),
                        });
                        const result = await res.json();
                        if (result.success) {
                          // Refresh the upcoming content
                          const upcomingRes = await fetch("/api/vault/upcoming");
                          const upcomingData = await upcomingRes.json();
                          setUpcomingContent(upcomingData.content || null);
                        }
                      } catch (error) {
                        console.error("Failed to regenerate upcoming file:", error);
                      }
                    }}
                    className="rounded bg-t-primary px-3 py-1.5 text-xs text-white hover:bg-t-primary/90"
                  >
                    Generate Upcoming Items
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
          {openSections.has("changelogs") && (() => {
            const groupedChangelogs = groupChangelogsByDate(changelogs);
            const groupOrder = ['Today', 'This Week', 'Older', 'Other'];

            return (
              <div className="flex flex-col gap-4">
                {groupOrder.map(groupName => {
                  const groupChangelogs = groupedChangelogs[groupName];
                  if (!groupChangelogs || groupChangelogs.length === 0) return null;

                  return (
                    <div key={groupName}>
                      <h4 className="text-xs font-medium text-t-text-muted mb-2 px-2">
                        {groupName} ({groupChangelogs.length})
                      </h4>
                      <div className="flex flex-col gap-1">
                        {groupChangelogs.map((c) => {
                          const isExpanded = expandedChangelog === c.name;
                          const { source, date } = getChangelogMetadata(c);

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
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {c.name.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                        sourceColors[source] || "bg-gray-500/10 text-gray-600"
                                      }`}
                                    >
                                      {source}
                                    </span>
                                  </div>
                                  {date && (
                                    <span className="text-[10px] text-t-text-muted">
                                      {date}
                                    </span>
                                  )}
                                </div>
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
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Orchestrator Documentation */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection("orchestrator")}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-t-text-secondary"
          >
            <span className="text-[10px]">
              {openSections.has("orchestrator") ? "v" : ">"}
            </span>
            Orchestrator Guide
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-600">
              AI Workflow Manager
            </span>
          </button>
          {openSections.has("orchestrator") && (
            <div className="rounded-lg bg-t-surface p-4 shadow-sm">
              <div className="prose-messages text-sm text-t-text space-y-6">

                {/* What is the Orchestrator */}
                <div>
                  <h3 className="text-base font-semibold text-t-text-bright mb-2 border-b border-t-border pb-1">
                    🤖 What is the Orchestrator?
                  </h3>
                  <p>
                    The Orchestrator is your AI-powered Mission Control dashboard manager. It&rsquo;s an intelligent agent that helps you coordinate workflows across multiple Devin AI and Claude Code sessions, monitor progress, and manage your development tasks efficiently.
                  </p>
                  <p className="mt-2">
                    Think of it as your personal AI assistant that understands your entire development ecosystem&mdash;from Linear tickets to session histories, vault knowledge, and active work streams.
                  </p>
                </div>

                {/* Key Capabilities */}
                <div>
                  <h3 className="text-base font-semibold text-t-text-bright mb-2 border-b border-t-border pb-1">
                    ⚡ Key Capabilities
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-t-surface-hover p-3">
                      <h4 className="font-medium text-t-text-bright mb-2">📋 Session Management</h4>
                      <ul className="text-xs text-t-text-secondary space-y-1">
                        <li>• View all active Devin and Claude sessions</li>
                        <li>• Create new sessions with optimal task distribution</li>
                        <li>• Monitor session progress and flag issues</li>
                        <li>• Stop or troubleshoot problematic sessions</li>
                      </ul>
                    </div>
                    <div className="rounded-lg bg-t-surface-hover p-3">
                      <h4 className="font-medium text-t-text-bright mb-2">📚 Knowledge Integration</h4>
                      <ul className="text-xs text-t-text-secondary space-y-1">
                        <li>• Browse vault patterns and changelogs</li>
                        <li>• Access completed session records</li>
                        <li>• Write session summaries to vault</li>
                        <li>• Leverage historical knowledge for decisions</li>
                      </ul>
                    </div>
                    <div className="rounded-lg bg-t-surface-hover p-3">
                      <h4 className="font-medium text-t-text-bright mb-2">🎯 Task Coordination</h4>
                      <ul className="text-xs text-t-text-secondary space-y-1">
                        <li>• Get actionable Linear backlog tickets</li>
                        <li>• Suggest which tasks to work on next</li>
                        <li>• Coordinate work between Devin and Claude</li>
                        <li>• Balance priorities and context</li>
                      </ul>
                    </div>
                    <div className="rounded-lg bg-t-surface-hover p-3">
                      <h4 className="font-medium text-t-text-bright mb-2">🔄 Workflow Orchestration</h4>
                      <ul className="text-xs text-t-text-secondary space-y-1">
                        <li>• Review board state and give summaries</li>
                        <li>• Identify workflow bottlenecks</li>
                        <li>• Suggest process improvements</li>
                        <li>• Automate routine coordination tasks</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* How to Use */}
                <div>
                  <h3 className="text-base font-semibold text-t-text-bright mb-2 border-b border-t-border pb-1">
                    🚀 How to Use the Orchestrator
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">1. Starting the Orchestrator</h4>
                      <div className="rounded-lg bg-t-surface-hover p-3 text-xs">
                        <p>Navigate to the <strong>Orchestrator</strong> tab and click &ldquo;Start Orchestrator&rdquo;.</p>
                        <p className="mt-1"><strong>💡 Tip:</strong> Enable &ldquo;Automatically review board state and tickets on start&rdquo; for an immediate overview of your current work.</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">2. Essential Commands</h4>
                      <div className="space-y-2 text-xs">
                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                          <strong className="text-blue-600">&ldquo;Show me the current board state&rdquo;</strong>
                          <p className="text-t-text-secondary mt-1">Gets an overview of all active Devin and Claude sessions with their statuses.</p>
                        </div>
                        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                          <strong className="text-green-600">&ldquo;What tickets should I work on next?&rdquo;</strong>
                          <p className="text-t-text-secondary mt-1">Analyzes Linear backlog and suggests prioritized tasks based on context.</p>
                        </div>
                        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                          <strong className="text-purple-600">&ldquo;Create a new Devin session to [task description]&rdquo;</strong>
                          <p className="text-t-text-secondary mt-1">Launches a new Devin AI session with your specified task.</p>
                        </div>
                        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
                          <strong className="text-orange-600">&ldquo;Write a summary of session [session-id] to the vault&rdquo;</strong>
                          <p className="text-t-text-secondary mt-1">Stores completed session records with full context in the vault.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">3. Advanced Workflows</h4>
                      <div className="rounded-lg bg-t-surface-hover p-3 text-xs space-y-2">
                        <p><strong>Session Coordination:</strong> &ldquo;I have a Claude session working on frontend and a Devin session on backend for the same feature. How should I coordinate them?&rdquo;</p>
                        <p><strong>Knowledge Synthesis:</strong> &ldquo;Look at recent vault patterns and suggest improvements for our current authentication work.&rdquo;</p>
                        <p><strong>Progress Monitoring:</strong> &ldquo;Check if any sessions are stuck and suggest next steps.&rdquo;</p>
                        <p><strong>Task Planning:</strong> &ldquo;Based on our vault knowledge and current sessions, create a plan for the user dashboard redesign.&rdquo;</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vault Integration */}
                <div>
                  <h3 className="text-base font-semibold text-t-text-bright mb-2 border-b border-t-border pb-1">
                    💾 Vault Integration
                  </h3>
                  <p>
                    The Orchestrator seamlessly integrates with your vault system to provide persistent knowledge management:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li><strong>Session Records:</strong> Completed sessions are automatically stored with full conversation history, metadata, costs, and tools used.</li>
                    <li><strong>Pattern Recognition:</strong> The orchestrator can read and reference vault patterns to inform new session creation and task coordination.</li>
                    <li><strong>Knowledge Synthesis:</strong> Historical session data helps the orchestrator make better recommendations for new work.</li>
                    <li><strong>Continuous Learning:</strong> Each interaction helps build a richer knowledge base for future coordination decisions.</li>
                  </ul>
                </div>

                {/* Best Practices */}
                <div>
                  <h3 className="text-base font-semibold text-t-text-bright mb-2 border-b border-t-border pb-1">
                    ✨ Best Practices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">🎯 Effective Communication</h4>
                      <ul className="space-y-1 text-t-text-secondary">
                        <li>• Be specific about what you want to achieve</li>
                        <li>• Provide context about your current work</li>
                        <li>• Ask for explanations of recommendations</li>
                        <li>• Use follow-up questions to dive deeper</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">📋 Session Management</h4>
                      <ul className="space-y-1 text-t-text-secondary">
                        <li>• Regularly check board state for stuck sessions</li>
                        <li>• Create sessions with clear, specific goals</li>
                        <li>• Use orchestrator to coordinate related sessions</li>
                        <li>• Write session summaries to capture learnings</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">🔄 Workflow Optimization</h4>
                      <ul className="space-y-1 text-t-text-secondary">
                        <li>• Start each day by reviewing the board state</li>
                        <li>• Use Linear integration to stay aligned with priorities</li>
                        <li>• Leverage vault patterns for consistency</li>
                        <li>• Ask for process improvement suggestions</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-t-text-bright mb-2">📚 Knowledge Building</h4>
                      <ul className="space-y-1 text-t-text-secondary">
                        <li>• Document important decisions in the vault</li>
                        <li>• Create patterns for recurring workflows</li>
                        <li>• Review session histories for improvement insights</li>
                        <li>• Share successful coordination strategies</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Example Interactions */}
                <div>
                  <h3 className="text-base font-semibold text-t-text-bright mb-2 border-b border-t-border pb-1">
                    💬 Example Interactions
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="rounded-lg border border-t-border p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="rounded bg-t-primary/20 px-2 py-0.5 text-t-primary font-medium">You</span>
                        <p>&ldquo;I&rsquo;m starting work on the payment system refactor. What&rsquo;s the best approach based on our vault patterns?&rdquo;</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-600 font-medium">Orchestrator</span>
                        <p>&ldquo;I&rsquo;ve reviewed your vault patterns for &lsquo;payment-processing&rsquo; and &lsquo;refactoring&rsquo;. I recommend starting with a Claude session to analyze the current architecture, then create a Devin session for the implementation. Based on pattern confidence levels, focus on the database migration strategy first...&rdquo;</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-t-border p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="rounded bg-t-primary/20 px-2 py-0.5 text-t-primary font-medium">You</span>
                        <p>&ldquo;My Devin session has been running for 2 hours without updates. What should I do?&rdquo;</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-600 font-medium">Orchestrator</span>
                        <p>&ldquo;I see session devin-abc123 has been in &lsquo;working&rsquo; status for 2.1 hours. This is above normal duration. I recommend sending a status check message or putting it to sleep if unresponsive. I can also create a backup Claude session for the same task if needed.&rdquo;</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-4 border-t border-t-border">
                  <p className="text-xs text-t-text-muted">
                    🌟 The Orchestrator learns from your interactions and vault data to provide increasingly intelligent workflow coordination.
                  </p>
                </div>

              </div>
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
