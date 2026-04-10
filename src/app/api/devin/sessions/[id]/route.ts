import { getSession, terminateSession } from "@/lib/devin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await getSession(id);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await terminateSession(id);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
