import { fetchTicketsFromVault, filterActionableTickets } from "@/lib/linear";

export async function GET() {
  const { data, error } = await fetchTicketsFromVault();
  if (error || !data) {
    return Response.json({ tickets: [], error }, { status: error ? 502 : 200 });
  }
  const tickets = filterActionableTickets(data.tickets);
  return Response.json({
    tickets,
    exportedAt: data.exportedAt,
    totalCount: data.totalCount,
  });
}
