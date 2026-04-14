"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODELS, EFFORT_LEVELS } from "@/lib/model-config";

type Agent = "devin" | "claude";

type CreateSessionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitDevin: (prompt: string) => Promise<void>;
  onSubmitClaude: (data: { title: string; repo: string; notes: string; model: string; effort: string }) => void;
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

  // Ensure repo and prompt are properly initialized
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (initialPrompt !== undefined && initialPrompt !== prompt) {
        setPrompt(initialPrompt);
        if (initialPrompt.trim()) {
          setAgent("devin");
        }
      }
      if (repos.length > 0 && !repo) {
        setRepo(repos[0]);
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [initialPrompt, repos, prompt, repo]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (agent === "devin") {
      if (!prompt.trim()) return;
      await onSubmitDevin(prompt);
      setPrompt("");
    } else {
      if (!title.trim() || !repo) return;
      onSubmitClaude({ title, repo, notes, model, effort });
      setTitle("");
      setNotes("");
    }
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-t-border bg-t-surface p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-t-text-bright">
          New Session
        </h2>

        {/* Agent toggle */}
        {claudeEnabled ? (
          <div className="mb-4 flex rounded-lg border border-t-border overflow-hidden">
            <button
              type="button"
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
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the task for Devin..."
              rows={5}
              className="w-full rounded-lg border border-t-border bg-t-bg px-4 py-3 text-sm text-t-text placeholder-t-text-muted outline-none transition-colors focus:border-t-primary"
              autoFocus
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-t-text-muted">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you working on?"
                  autoFocus
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
