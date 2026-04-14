import { getSession } from "@/lib/claude-sdk";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastSentIndex = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Send existing messages first
      for (const msg of session.messages) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
        );
      }
      lastSentIndex = session.messages.length;

      // Poll for new messages (1s) with less frequent heartbeats (15s)
      let ticksSinceHeartbeat = 0;
      const interval = setInterval(() => {
        if (session.messages.length > lastSentIndex) {
          for (let i = lastSentIndex; i < session.messages.length; i++) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify(session.messages[i])}\n\n`
              )
            );
          }
          lastSentIndex = session.messages.length;
          ticksSinceHeartbeat = 0;
        }

        // Send heartbeat every ~15s to keep connection alive
        ticksSinceHeartbeat++;
        if (ticksSinceHeartbeat >= 15) {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          ticksSinceHeartbeat = 0;
        }

        // Close if session is done
        if (session.status === "done") {
          clearInterval(interval);
          controller.close();
        }
      }, 1_000);

      // Clean up on abort
      _request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
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
