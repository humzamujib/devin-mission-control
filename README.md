# Mission Control

A dashboard for orchestrating Devin AI sessions. Kanban board, multi-session split view, knowledge management, and Linear ticket integration.

## Features

- **Kanban Board** — Sessions organized into Queued, Running, Needs Input, Idle, and Finished columns with live polling
- **Multi-Session Split View** — Open multiple sessions side-by-side with color-coded borders linking cards to panes. Three layout modes: board, split, and focus
- **Session Messaging** — Send messages to active sessions, view conversation history with markdown rendering and Slack link support
- **Idle / Sleep** — Move blocked sessions to Idle when you're done with them. Sleep button to suspend sessions via the API
- **PR Retention** — Sessions with open PRs stay visible in Idle instead of disappearing to Finished
- **Knowledge Management** — Browse, create, edit, and delete Devin knowledge notes. Filter by your notes vs org-wide, search, folder navigation
- **Linear Integration** — View backlog tickets from a synced vault repo. Expand a ticket, add instructions, and launch a Devin session directly. Sync triggers a Devin playbook to refresh ticket data
- **Themes** — Alabaster (light, WCAG AA+), Navy (dark blue), and Forest (dark green). Switchable in Settings, persisted to localStorage

## Setup

```bash
git clone https://github.com/humzamujib/devin-mission-control.git
cd devin-mission-control
npm install
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```
DEVIN_API_TOKEN=apk_user_...          # Devin API token
GITHUB_TOKEN=gho_...                   # GitHub token (for reading vault repo)
NEXT_PUBLIC_DEVIN_USER_EMAIL=you@co.com       # Your Devin email
NEXT_PUBLIC_DEVIN_USER_NAME=Your Name          # Your display name
NEXT_PUBLIC_DEVIN_ENTERPRISE_URL=https://your-org.devinenterprise.com
LINEAR_VAULT_REPO=owner/repo           # GitHub repo with linear/tickets.json
LINEAR_SYNC_PLAYBOOK_ID=playbook-...   # Devin playbook ID for Linear sync
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
| `GITHUB_TOKEN` | For Linear | Server | GitHub PAT to read the vault repo |
| `NEXT_PUBLIC_DEVIN_USER_EMAIL` | Yes | Client | Filters sessions to your email |
| `NEXT_PUBLIC_DEVIN_USER_NAME` | Yes | Client | Used to identify your knowledge notes |
| `NEXT_PUBLIC_DEVIN_ENTERPRISE_URL` | Yes | Client | Base URL for Devin session links |
| `LINEAR_VAULT_REPO` | For Linear | Server | GitHub `owner/repo` containing `linear/tickets.json` |
| `LINEAR_SYNC_PLAYBOOK_ID` | For Linear | Server | Devin playbook that exports Linear tickets to the vault |

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS 4
- TypeScript
- Devin API (v1)
- GitHub API (for Linear vault sync)

## Project Structure

```
src/
  app/
    page.tsx                    # Main page with Kanban, split view, tabs
    api/devin/sessions/         # Proxy routes to Devin API
    api/devin/knowledge/        # Knowledge CRUD routes
    api/linear/issues/          # Reads tickets from GitHub vault
    api/linear/sync/            # Triggers Devin playbook for Linear sync
  components/
    Header.tsx                  # Tab navigation, session count, actions
    KanbanBoard.tsx             # Column layout with session cards
    SessionCard.tsx             # Individual session card
    SessionPane.tsx             # Session detail with messages, actions
    SessionSplitView.tsx        # Multi-pane container with layout switcher
    KnowledgePanel.tsx          # Knowledge note browser and editor
    LinearPanel.tsx             # Linear ticket list with Devin dispatch
    CreateSessionModal.tsx      # New session creation dialog
    SettingsPanel.tsx           # Theme switcher
  lib/
    devin.ts                    # Devin API client
    knowledge.ts                # Knowledge API client
    linear.ts                   # Vault fetch + playbook trigger
    themes.ts                   # Theme definitions and persistence
  types/
    index.ts                    # Session types
    knowledge.ts                # Knowledge types
```
