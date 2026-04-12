"use client";

import { useState, useEffect } from "react";

type CreateSessionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<void>;
  initialPrompt?: string;
};

export default function CreateSessionModal({
  open,
  onClose,
  onSubmit,
  initialPrompt = "",
}: CreateSessionModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && initialPrompt) setPrompt(initialPrompt);
  }, [open, initialPrompt]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    await onSubmit(prompt);
    setPrompt("");
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-t-border bg-t-surface p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-t-text-bright">
          Create Devin Session
        </h2>
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the task for Devin..."
            rows={5}
            className="w-full rounded-lg border border-t-border bg-t-bg px-4 py-3 text-sm text-t-text placeholder-t-text-muted outline-none transition-colors focus:border-t-primary"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-t-border px-4 py-2 text-sm text-t-text-secondary transition-colors hover:bg-t-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="rounded-lg bg-t-primary px-4 py-2 text-sm font-medium text-t-text-bright transition-colors hover:bg-t-primary-hover disabled:opacity-50"
            >
              {loading ? "Creating..." : "Launch Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
