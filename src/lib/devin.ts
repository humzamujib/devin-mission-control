const DEVIN_API_BASE = "https://api.devin.ai/v1";

function getHeaders(): HeadersInit {
  const token = process.env.DEVIN_API_TOKEN;
  if (!token) throw new Error("DEVIN_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listSessions(): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/sessions`, {
    headers: getHeaders(),
    cache: "no-store",
  });
}

export async function getSession(sessionId: string): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/session/${sessionId}`, {
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
  return fetch(`${DEVIN_API_BASE}/session/${sessionId}/message`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message }),
  });
}
