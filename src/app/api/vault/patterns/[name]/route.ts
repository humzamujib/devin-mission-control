import { readFile } from "@/lib/vault";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const content = await readFile(`patterns/${name}.md`);
  if (!content) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ content });
}
