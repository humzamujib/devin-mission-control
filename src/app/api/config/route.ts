import { execSync } from "child_process";

function claudeCliAvailable(): boolean {
  // Check for API key first, then fall back to checking if CLI is installed
  if (process.env.ANTHROPIC_API_KEY) return true;
  try {
    execSync("which claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  return Response.json({
    claudeEnabled: claudeCliAvailable(),
    linearEnabled: !!process.env.LINEAR_VAULT_REPO,
    vaultEnabled: !!process.env.LINEAR_VAULT_REPO && !!process.env.GITHUB_TOKEN,
    postgresEnabled: process.env.POSTGRES_ENABLED === 'true',
    postgresReadEnabled: process.env.POSTGRES_READ_ENABLED === 'true',
  });
}
