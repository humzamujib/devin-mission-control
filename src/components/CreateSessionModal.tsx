"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODELS, EFFORT_LEVELS } from "@/lib/model-config";

type Agent = "devin" | "claude";

type ClaudeSessionData = {
  title: string;
  repo: string;
  notes: string;
  model: string;
  effort: string;
};

type CreateSessionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitDevin: (prompt: string) => Promise<void>;
  onSubmitClaude: (data: ClaudeSessionData) => void;
  initialPrompt?: string;
  repos: string[];
  defaultModel: string;
  defaultEffort: string;
  claudeEnabled?: boolean;
};

export default function CreateSessionModal({
  open,
  onClose,
  onSubmitDevin,
  onSubmitClaude,
  initialPrompt = "",
  repos,
  defaultModel,
  defaultEffort,
  claudeEnabled = true,
}: CreateSessionModalProps) {
  const [agent, setAgent] = useState<Agent>("devin");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState(repos[0] || "");
  const [notes, setNotes] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [effort, setEffort] = useState(defaultEffort);
  const [loading, setLoading] = useState(false);

  // Initialize repo and prompt when modal opens or props change
  // NOTE: prompt is intentionally excluded from dependencies to prevent infinite loops
  useEffect(() => {
    if (open) {
      if (initialPrompt !== undefined && initialPrompt !== prompt) {
        setPrompt(initialPrompt);
        if (initialPrompt.trim()) {
          setAgent("devin");
        }
      }
      if (repos.length > 0 && !repo) {
        setRepo(repos[0]);
      }
    }
  }, [open, initialPrompt, repos, repo]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (agent === "devin" && !prompt.trim()) return;
    if (agent === "claude" && (!title.trim() || !repo)) return;

    setLoading(true);

    try {
      if (agent === "devin") {
        await onSubmitDevin(prompt);
        setPrompt("");
      } else {
        onSubmitClaude({ title, repo, notes, model, effort });
        setTitle("");
        setNotes("");
      }
      onClose();
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-t-border bg-t-surface p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="mb-4 text-lg font-semibold text-t-text-bright">
          New Session
        </h2>

        {/* Agent toggle */}
        {claudeEnabled ? (
          <div
            className="mb-4 flex rounded-lg border border-t-border overflow-hidden"
            role="tablist"
            aria-label="Select agent type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={agent === "devin"}
              aria-controls="agent-devin"
              onClick={() => setAgent("devin")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                agent === "devin"
                  ? "bg-t-success/15 text-t-success"
                  : "text-t-text-muted hover:text-t-text-secondary"
              }`}
            >
              Devin
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={agent === "claude"}
              aria-controls="agent-claude"
              onClick={() => setAgent("claude")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                agent === "claude"
                  ? "bg-purple-500/15 text-purple-600"
                  : "text-t-text-muted hover:text-t-text-secondary"
              }`}
            >
              Claude
            </button>
          </div>
        ) : (
          <p className="mb-4 text-xs text-t-text-muted">Devin Session</p>
        )}

        <form onSubmit={handleSubmit}>
          {agent === "devin" ? (
            <div id="agent-devin" role="tabpanel" aria-labelledby="devin-tab">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the task for Devin..."
                rows={5}
                className="w-full rounded-lg border border-t-border bg-t-bg px-4 py-3 text-sm text-t-text placeholder-t-text-muted outline-none transition-colors focus:border-t-primary"
                autoFocus
                aria-label="Task description for Devin"
              />
            </div>
          ) : (
            <div id="agent-claude" role="tabpanel" aria-labelledby="claude-tab" className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-t-text-muted">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you working on?"
                  autoFocus
                  aria-label="Session title"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-t-text-muted">
                  Repository
                </label>
                <select
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
                  aria-label="Repository selection"
                >
                  {repos.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-t-text-muted">
                    Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
                    aria-label="Model selection"
                  >
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-t-text-muted">
                    Effort
                  </label>
                  <select
                    value={effort}
                    onChange={(e) => setEffort(e.target.value)}
                    className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
                    aria-label="Effort level selection"
                  >
                    {EFFORT_LEVELS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-t-text-muted">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Context, goals, setup instructions..."
                  rows={3}
                  className="w-full rounded-lg border border-t-border bg-t-bg px-4 py-3 text-sm text-t-text placeholder-t-text-muted outline-none transition-colors focus:border-t-primary"
                  aria-label="Session notes"
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                (agent === "devin" ? !prompt.trim() : !title.trim() || !repo)
              }
              className={
                agent === "claude"
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : ""
              }
            >
              {loading
                ? "Creating..."
                : agent === "devin"
                  ? "Launch Devin Session"
                  : "Start Claude Session"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
