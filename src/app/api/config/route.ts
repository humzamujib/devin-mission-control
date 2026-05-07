export async function GET() {
  return Response.json({
    claudeEnabled: !!process.env.ANTHROPIC_API_KEY,
    linearEnabled: !!process.env.LINEAR_VAULT_REPO,
    vaultEnabled: !!process.env.LINEAR_VAULT_REPO && !!process.env.GITHUB_TOKEN,
    knowledgeEnabled: process.env.KNOWLEDGE_ENABLED === "true",
    postgresEnabled: process.env.POSTGRES_ENABLED === 'true',
    postgresReadEnabled: process.env.POSTGRES_READ_ENABLED === 'true',
  });
}
