# Mission Control

A dashboard for orchestrating Devin AI sessions. Kanban board, multi-session split view, knowledge management, vault browser, and Linear ticket integration.

## Features

- **Kanban Board** — Sessions organized into Queued, Running, Needs Input, Idle, and Finished columns with live polling
- **Multi-Session Split View** — Open multiple sessions side-by-side with color-coded borders linking cards to panes. Three layout modes: board, split, and focus
- **Session Messaging** — Send messages to active sessions, view conversation history with markdown rendering and Slack link support
- **Idle / Sleep** — Move blocked sessions to Idle when you're done with them. Sleep button to suspend sessions via the API
- **PR Retention** — Sessions with open PRs stay visible in Idle instead of disappearing to Finished
- **Knowledge Management** — Browse, create, edit, and delete Devin knowledge notes. Filter by your notes vs org-wide, search, folder navigation
- **Vault Browser** — Browse your ai-vault patterns, changelogs, and health stats directly from the dashboard
- **Linear Integration** — View backlog tickets from a synced vault repo. Expand a ticket, add instructions, and launch a Devin session directly
- **Themes** — Alabaster (light, WCAG AA+), Navy (dark blue), and Forest (dark green). Switchable in Settings, persisted to localStorage

## How It Works

Mission Control connects three systems:

### Devin API
The core integration. The dashboard proxies requests to the Devin v1 API to list sessions, create new ones, send messages, and manage knowledge notes. Your `DEVIN_API_TOKEN` authenticates all of this.

### AI Vault (optional)
The **vault** is a GitHub repository that acts as a persistent memory system for Devin sessions. Instead of starting every session from scratch, Devin reads patterns and changelogs from the vault to maintain context across sessions.

The vault contains:
- **Patterns** — Coding conventions with metadata (tags, repos, confidence scores). These are automatically synced to Devin Knowledge Notes so they get injected into sessions based on task context.
- **Changelogs** — Session-by-session logs of what was done, decisions made, and review feedback received.
- **Linear tickets** — An export of your Linear backlog (`linear/tickets.json`), written by a Devin playbook.
- **Analysis** — PR analysis reports, weekly distillation digests.

The vault is completely optional. Sessions, knowledge management, and themes all work without it. If you want vault features, create a GitHub repo with the structure above and point `LINEAR_VAULT_REPO` at it.

### Linear (via vault)
Since many orgs restrict direct Linear API access, the dashboard reads Linear tickets indirectly: a Devin playbook fetches your tickets and writes them as JSON to the vault repo. The dashboard reads that JSON via the GitHub API. Click "Sync" in the Linear panel to trigger a fresh export.

```
Linear API  -->  Devin playbook  -->  vault repo (linear/tickets.json)  -->  GitHub API  -->  Dashboard
```

This means you need:
1. A Devin playbook that exports your Linear tickets to the vault repo
2. The playbook ID in `LINEAR_SYNC_PLAYBOOK_ID`
3. A `GITHUB_TOKEN` with read access to the vault repo

## Setup

```bash
git clone https://github.com/humzamujib/devin-mission-control.git
cd devin-mission-control
npm install
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```
DEVIN_API_TOKEN=apk_user_...
GITHUB_TOKEN=gho_...
NEXT_PUBLIC_DEVIN_USER_EMAIL=you@company.com
NEXT_PUBLIC_DEVIN_USER_NAME=Your Name
NEXT_PUBLIC_DEVIN_ENTERPRISE_URL=https://your-org.devinenterprise.com
LINEAR_VAULT_REPO=owner/repo
LINEAR_SYNC_PLAYBOOK_ID=playbook-...
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `DEVIN_API_TOKEN` | Yes | Server | Your Devin API key (`apk_user_...`) |
| `GITHUB_TOKEN` | For vault/Linear | Server | GitHub PAT to read the vault repo |
| `NEXT_PUBLIC_DEVIN_USER_EMAIL` | Yes | Client | Filters sessions to your email |
| `NEXT_PUBLIC_DEVIN_USER_NAME` | Yes | Client | Used to identify your knowledge notes |
| `NEXT_PUBLIC_DEVIN_ENTERPRISE_URL` | Yes | Client | Base URL for Devin session links |
| `LINEAR_VAULT_REPO` | For vault/Linear | Server | GitHub `owner/repo` for the vault |
| `LINEAR_SYNC_PLAYBOOK_ID` | For Linear sync | Server | Devin playbook that exports Linear tickets to the vault |

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS 4
- TypeScript
- Devin API (v1)
- GitHub API (vault + Linear sync)

## Project Structure

```
src/
  app/
    page.tsx                    # Main page with Kanban, split view, tabs
    api/devin/sessions/         # Proxy routes to Devin session API
    api/devin/knowledge/        # Knowledge CRUD routes
    api/linear/issues/          # Reads tickets from vault
    api/linear/sync/            # Triggers Devin playbook for Linear sync
    api/vault/patterns/         # Lists/reads vault patterns
    api/vault/changelogs/       # Lists/reads vault changelogs
    api/vault/index/            # Reads vault-index.md health stats
  components/
    Header.tsx                  # Tab navigation, session count, actions
    KanbanBoard.tsx             # Column layout with session cards
    SessionCard.tsx             # Individual session card
    SessionPane.tsx             # Session detail with messages, actions
    SessionSplitView.tsx        # Multi-pane container with layout switcher
    KnowledgePanel.tsx          # Knowledge note browser and editor
    VaultPanel.tsx              # Vault patterns, changelogs, health browser
    LinearPanel.tsx             # Linear ticket list with Devin dispatch
    CreateSessionModal.tsx      # New session creation dialog
    SettingsPanel.tsx           # Theme switcher
  lib/
    devin.ts                    # Devin API client
    knowledge.ts                # Knowledge API client
    linear.ts                   # Vault-based Linear ticket fetch
    vault.ts                    # Vault GitHub API client
    themes.ts                   # Theme definitions and persistence
  types/
    index.ts                    # Session types
    knowledge.ts                # Knowledge types
```
