import { DEVIN_API_BASE } from "./devin";

function getHeaders(): HeadersInit {
  const token = process.env.DEVIN_API_TOKEN;
  if (!token) throw new Error("DEVIN_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listKnowledge(): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/knowledge`, {
    headers: getHeaders(),
    cache: "no-store",
  });
}

export async function createKnowledge(body: {
  name: string;
  body: string;
  trigger_description: string;
  parent_folder_id?: string | null;
  pinned_repo?: string | null;
}): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/knowledge`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
}

export async function updateKnowledge(
  noteId: string,
  body: {
    name: string;
    body: string;
    trigger_description: string;
    parent_folder_id?: string | null;
    pinned_repo?: string | null;
  }
): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/knowledge/${noteId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
}

export async function deleteKnowledge(noteId: string): Promise<Response> {
  return fetch(`${DEVIN_API_BASE}/knowledge/${noteId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}
