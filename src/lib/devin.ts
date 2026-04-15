export const DEVIN_API_BASE = "https://api.devin.ai/v1";

function getHeaders(): HeadersInit {
  const token = process.env.DEVIN_API_TOKEN;
  if (!token) throw new Error("DEVIN_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listSessions(userEmail?: string): Promise<Response> {
  const url = new URL(`${DEVIN_API_BASE}/sessions`);
  url.searchParams.set("limit", "100");
  if (userEmail) {
    url.searchParams.set("user_email", userEmail);
  }
  return fetch(url.toString(), {
    headers: getHeaders(),
    cache: "no-store",
  });
}

export async function getSession(sessionId: string): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/sessions/${sessionId}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
}

export async function createSession(prompt: string): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/sessions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ prompt }),
  });
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/sessions/${sessionId}/message`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message }),
  });
}

export async function terminateSession(sessionId: string): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

export async function sleepSession(sessionId: string): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/sessions/${sessionId}/sleep`, {
    method: "POST",
    headers: getHeaders(),
  });
}

/**
 * Update session status based on PR state
 * Uses appropriate Devin API endpoints to transition sessions
 */
export async function updateSessionStatus(
  sessionId: string,
  targetStatus: "finished" | "idle" | "blocked"
): Promise<Response> {
  switch (targetStatus) {
    case "finished":
      // Sleep the session to mark it as finished
      return sleepSession(sessionId);

    case "idle":
      // Also sleep for idle - the system will show it as idle if it has open PR
      return sleepSession(sessionId);

    case "blocked":
      // For blocked status, we can send a message indicating external dependency
      return sendMessage(sessionId, "⏳ Session blocked - waiting for external dependencies");

    default:
      throw new Error(`Unsupported target status: ${targetStatus}`);
  }
}
