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

      // Poll for new messages
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
        }

        // Send heartbeat
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));

        // Close if session is done
        if (session.status === "done") {
          clearInterval(interval);
          controller.close();
        }
      }, 500);

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
