const LINEAR_API_URL = "https://api.linear.app/graphql";

function getHeaders(): HeadersInit {
  const token = process.env.LINEAR_API_KEY;
  if (!token) throw new Error("LINEAR_API_KEY is not set");
  return {
    Authorization: token,
    "Content-Type": "application/json",
  };
}

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; color: string };
  assignee?: { name: string; email: string } | null;
  url: string;
  priority: number;
  labels: { nodes: { name: string; color: string }[] };
};

const ISSUES_QUERY = `
  query GetIssues($teamId: String, $first: Int) {
    issues(
      filter: {
        team: { key: { eq: $teamId } }
        state: { type: { nin: ["canceled", "completed"] } }
      }
      first: $first
      orderBy: updatedAt
    ) {
      nodes {
        id
        identifier
        title
        state { name color }
        assignee { name email }
        url
        priority
        labels { nodes { name color } }
      }
    }
  }
`;

export async function getIssues(
  teamKey?: string,
  first = 50
): Promise<{ issues: LinearIssue[]; error?: string }> {
  try {
    const res = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        query: ISSUES_QUERY,
        variables: { teamId: teamKey || null, first },
      }),
    });
    const data = await res.json();
    if (data.errors) {
      return { issues: [], error: data.errors[0]?.message };
    }
    return { issues: data.data?.issues?.nodes ?? [] };
  } catch (err) {
    return {
      issues: [],
      error: err instanceof Error ? err.message : "Linear API error",
    };
  }
}

const TEAMS_QUERY = `
  query { teams { nodes { id key name } } }
`;

export async function getTeams(): Promise<
  { id: string; key: string; name: string }[]
> {
  try {
    const res = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ query: TEAMS_QUERY }),
    });
    const data = await res.json();
    return data.data?.teams?.nodes ?? [];
  } catch {
    return [];
  }
}
