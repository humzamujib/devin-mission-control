import { readFile } from "@/lib/vault";

export async function GET() {
  const content = await readFile("vault-index.md");
  if (!content) {
    return Response.json({ error: "Vault index not found" }, { status: 404 });
  }
  return Response.json({ content });
}
