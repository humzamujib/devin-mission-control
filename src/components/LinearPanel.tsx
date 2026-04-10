"use client";

import { useState, useEffect } from "react";

type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; color: string };
  assignee?: { name: string; email: string } | null;
  url: string;
  priority: number;
  labels: { nodes: { name: string; color: string }[] };
};

type LinearPanelProps = {
  open: boolean;
  onClose: () => void;
  onSendToDevin: (prompt: string) => void;
};

export default function LinearPanel({
  open,
  onClose,
  onSendToDevin,
}: LinearPanelProps) {
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/linear/issues")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setIssues(data.issues || []);
        }
      })
      .catch(() => setError("Failed to fetch Linear issues"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  function handleSendToDevin(issue: LinearIssue) {
    const prompt = `Work on Linear issue ${issue.identifier}: "${issue.title}"\n\nLinear URL: ${issue.url}`;
    onSendToDevin(prompt);
  }

  return (
    <div className="fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-indigo-500" />
          <h2 className="text-sm font-semibold text-white">Linear Issues</h2>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="p-4 text-xs text-zinc-500">Loading issues...</p>
        )}
        {error && (
          <div className="m-3 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-400">
            {error}
            <p className="mt-1 text-zinc-500">
              Set LINEAR_API_KEY in .env.local
            </p>
          </div>
        )}
        {!loading &&
          !error &&
          issues.map((issue) => (
            <div
              key={issue.id}
              className="border-b border-zinc-800/50 px-4 py-3 transition-colors hover:bg-zinc-900"
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: issue.state.color }}
                />
                <span className="text-xs font-medium text-zinc-500">
                  {issue.identifier}
                </span>
                {issue.priority <= 2 && issue.priority > 0 && (
                  <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] text-red-400">
                    P{issue.priority}
                  </span>
                )}
              </div>
              <p className="mb-2 text-sm text-zinc-300 line-clamp-2">
                {issue.title}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {issue.labels.nodes.slice(0, 2).map((label) => (
                    <span
                      key={label.name}
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: label.color + "20",
                        color: label.color,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleSendToDevin(issue)}
                  className="rounded bg-indigo-600/20 px-2 py-1 text-[10px] font-medium text-indigo-400 transition-colors hover:bg-indigo-600/40"
                >
                  Send to Devin
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
