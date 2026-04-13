"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type OrcMessage = {
  type: string;
  text: string;
  timestamp: string;
  toolName?: string;
};

export default function OrchestratorPanel() {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("stopped");
  const [messages, setMessages] = useState<OrcMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  // Poll orchestrator state
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/orchestrator");
        const data = await res.json();
        setActive(data.active);
        setStatus(data.status || "stopped");
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } catch {}
      setInitialLoading(false);
    };
    poll();
    // Poll faster (1s) for responsive feel
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
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
          {messages.map((msg, i) => {
            if (msg.type === "tool") {
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-t-surface-hover text-[10px] text-t-text-muted"
                >
                  <span className="font-mono font-medium">
                    {msg.toolName}
                  </span>
                  <span className="truncate">{msg.text}</span>
                </div>
              );
            }

            if (msg.type === "result") {
              return (
                <div
                  key={i}
                  className="text-center text-[10px] text-t-text-muted py-1"
                >
                  Turn complete
                </div>
              );
            }

            const fromUser = msg.type === "user";
            return (
              <div
                key={i}
                className={`flex gap-3 ${fromUser ? "flex-row-reverse" : ""}`}
              >
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
          })}
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
