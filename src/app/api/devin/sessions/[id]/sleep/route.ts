import { DEVIN_API_BASE } from "@/lib/devin";

type ErrorResponse = {
  error: string;
  status?: number;
  fallback_available?: boolean;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const token = process.env.DEVIN_API_TOKEN;
    if (!token) {
      return Response.json({ error: "DEVIN_API_TOKEN is not set" }, { status: 500 });
    }

    // Try to sleep the session using Devin API
    const response = await fetch(`${DEVIN_API_BASE}/sessions/${id}/sleep`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If sleep fails, provide a fallback error message
      const errorMessage = typeof data === "object" && data && typeof data.detail === "string"
        ? data.detail
        : typeof data === "object" && data && typeof data.message === "string"
        ? data.message
        : "Failed to sleep session";

      const errorResponse: ErrorResponse = {
        error: errorMessage,
        status: response.status,
        fallback_available: true
      };

      return Response.json(errorResponse, { status: response.status });
    }

    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("Sleep session error:", error);
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : "Unknown error occurred",
      fallback_available: true
    };

    return Response.json(errorResponse, { status: 500 });
  }
}