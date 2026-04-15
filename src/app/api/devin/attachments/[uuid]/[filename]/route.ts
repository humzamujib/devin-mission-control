import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string; filename: string }> }
) {
  const { uuid, filename } = await params;

  const token = process.env.DEVIN_API_TOKEN;
  if (!token) {
    return Response.json({ error: "DEVIN_API_TOKEN is not set" }, { status: 500 });
  }

  const attachmentUrl = `https://app.devin.ai/attachments/${uuid}/${filename}`;

  try {
    // Test 1: Standard Bearer token (confirmed to fail)
    const bearerResponse = await fetch(attachmentUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (bearerResponse.ok) {
      const content = await bearerResponse.text();
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": bearerResponse.headers.get("Content-Type") || "text/plain",
        },
      });
    }

    // Test 2: X-API-Key header (confirmed to fail)
    const apiKeyResponse = await fetch(attachmentUrl, {
      headers: {
        "X-API-Key": token,
      },
    });

    if (apiKeyResponse.ok) {
      const content = await apiKeyResponse.text();
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": apiKeyResponse.headers.get("Content-Type") || "text/plain",
        },
      });
    }

    // Test 3: Try v1 API endpoint
    const v1Response = await fetch(`https://api.devin.ai/v1/attachments/${uuid}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (v1Response.ok) {
      const content = await v1Response.text();
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": v1Response.headers.get("Content-Type") || "text/plain",
        },
      });
    }

    // Return detailed error information for debugging
    const bearerError = await bearerResponse.text().catch(() => "Failed to read response");
    const apiKeyError = await apiKeyResponse.text().catch(() => "Failed to read response");
    const v1Error = await v1Response.text().catch(() => "Failed to read response");

    return Response.json({
      error: "All authentication methods failed",
      attempts: {
        bearer: {
          status: bearerResponse.status,
          error: bearerError,
          url: attachmentUrl,
        },
        apiKey: {
          status: apiKeyResponse.status,
          error: apiKeyError,
          url: attachmentUrl,
        },
        v1Api: {
          status: v1Response.status,
          error: v1Error,
          url: `https://api.devin.ai/v1/attachments/${uuid}`,
        },
      },
    }, { status: 502 });

  } catch (error) {
    return Response.json({
      error: "Fetch failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}