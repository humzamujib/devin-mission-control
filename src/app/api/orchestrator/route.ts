import { NextRequest } from "next/server";
import {
  getOrchestrator,
  startOrchestrator,
  sendToOrchestrator,
  stopOrchestrator,
} from "@/lib/orchestrator";

export async function GET() {
  const orch = getOrchestrator();
  if (!orch) {
    return Response.json({ active: false, messages: [], status: "stopped" });
  }
  return Response.json({
    active: true,
    status: orch.status,
    messageCount: orch.messages.length,
    messages: orch.messages.slice(-50),
  });
}

export async function POST(request: NextRequest) {
  const { action, message } = await request.json();

  if (action === "start") {
    const started = startOrchestrator();
    return Response.json({ started });
  }

  if (action === "stop") {
    stopOrchestrator();
    return Response.json({ stopped: true });
  }

  if (action === "send" && message) {
    const sent = await sendToOrchestrator(message);
    return Response.json({ sent });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}

// SSE stream for the orchestrator
export async function PUT() {
  const orch = getOrchestrator();
  if (!orch) {
    return Response.json({ error: "Orchestrator not running" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastSentIndex = 0;

  const stream = new ReadableStream({
    start(controller) {
      for (const msg of orch.messages) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      }
      lastSentIndex = orch.messages.length;

      const interval = setInterval(() => {
        const current = getOrchestrator();
        if (!current) {
          clearInterval(interval);
          controller.close();
          return;
        }

        if (current.messages.length > lastSentIndex) {
          for (let i = lastSentIndex; i < current.messages.length; i++) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(current.messages[i])}\n\n`)
            );
          }
          lastSentIndex = current.messages.length;
        }

        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
