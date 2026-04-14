"use client";

import { useState, useEffect, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePageVisible } from "@/hooks/usePageVisible";
import { MODELS, EFFORT_LEVELS } from "@/lib/model-config";

type OrchestratorPanelProps = {
  defaultModel: string;
  defaultEffort: string;
};

type OrcMessage_t = {
  type: string;
  text: string;
  timestamp: string;
  toolName?: string;
};

const OrcMessage = memo(function OrcMessage({ msg }: { msg: OrcMessage_t }) {
  if (msg.type === "tool") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-t-surface-hover text-[10px] text-t-text-muted">
        <span className="font-mono font-medium">{msg.toolName}</span>
        <span className="truncate">{msg.text}</span>
      </div>
    );
  }

  if (msg.type === "result") {
    return (
      <div className="text-center text-[10px] text-t-text-muted py-1">
        Turn complete
      </div>
    );
  }

  const fromUser = msg.type === "user";
  return (
    <div className={`flex gap-3 ${fromUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback
          className={`text-[10px] font-medium ${
            fromUser
              ? "bg-t-primary/20 text-t-primary"
              : "bg-purple-500/15 text-purple-600"
          }`}
        >
          {fromUser ? "U" : "O"}
        </AvatarFallback>
      </Avatar>
      <div
        className={`rounded-xl border px-4 py-2.5 max-w-[80%] ${
          fromUser
            ? "border-t-msg-user-border bg-t-msg-user-bg"
            : "border-t-msg-devin-border bg-t-msg-devin-bg"
        }`}
      >
        <div className="prose-messages text-sm text-t-text">
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
        <p className="mt-1 text-[9px] text-t-text-muted/50">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
});

export default function OrchestratorPanel({ defaultModel, defaultEffort }: OrchestratorPanelProps) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("stopped");
  const [messages, setMessages] = useState<OrcMessage_t[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reviewTickets, setReviewTickets] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [effort, setEffort] = useState(defaultEffort);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageVisible = usePageVisible();

  // Poll orchestrator state
  useEffect(() => {
    if (!pageVisible) return;
    const ac = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch("/api/orchestrator", { signal: ac.signal });
        const data = await res.json();
        setActive(data.active);
        setStatus(data.status || "stopped");
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[Orchestrator] Poll failed:", err);
      }
      setInitialLoading(false);
    };
    poll();
    const interval = setInterval(poll, 5_000);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [pageVisible]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", reviewTickets, model, effort }),
      });
      await res.json();
      // If started=false, orchestrator was already running — just reconnect
      setActive(true);
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    setActive(false);
    setStatus("stopped");
  }

  // Reset sending state when orchestrator restarts
  useEffect(() => {
    setSending(false);
  }, [active]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const msg = input;
    setInput("");
    setSending(true);
    try {
      await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", message: msg }),
      });
    } finally {
      setSending(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-t-text-muted">Connecting...</p>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-lg font-semibold text-t-text-bright">
            Orchestrator
          </h2>
          <p className="mb-4 text-sm text-t-text-muted max-w-md">
            Start the orchestrator to manage sessions, monitor the board, and
            coordinate work across Devin and Claude. It has full access to
            your vault, Linear tickets, and can create new sessions.
          </p>
          <div className="mb-4 flex justify-center gap-3 max-w-sm mx-auto">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-t-text-muted">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-t-text-muted">Effort</label>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
              >
                {EFFORT_LEVELS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4 flex items-center justify-center gap-2">
            <input
              type="checkbox"
              id="reviewTickets"
              checked={reviewTickets}
              onChange={(e) => setReviewTickets(e.target.checked)}
              className="h-4 w-4 rounded border-t-border text-t-primary focus:ring-t-primary"
            />
            <label
              htmlFor="reviewTickets"
              className="text-sm text-t-text-secondary cursor-pointer"
            >
              Automatically review board state and tickets on start
            </label>
          </div>
          <Button onClick={handleStart} disabled={starting}>
            {starting ? "Starting..." : "Start Orchestrator"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-t-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-t-text-bright">
              Orchestrator
            </h2>
          </div>
          <span className="text-[10px] text-t-text-muted">{status}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          className="h-7 text-xs text-t-text-muted"
        >
          Stop
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 px-6 py-4 max-w-3xl mx-auto">
          {messages.map((msg, i) => (
            <OrcMessage key={i} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="px-6 py-3">
        <form
          onSubmit={handleSend}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the orchestrator..."
            className="text-sm"
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            {sending ? "..." : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
