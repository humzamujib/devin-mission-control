# Mission Control

A dashboard for orchestrating AI coding sessions across Devin and Claude. Kanban board, multi-session management, persistent vault with pattern injection, and an AI orchestrator that coordinates everything.

## Features

### Session Management
- **Kanban Board** — Sessions in Queued, Running, Needs Input, Idle, and Finished columns with live polling
- **Multi-Session Split View** — Open multiple sessions side-by-side with color-coded borders. Three layouts: board, split, focus
- **Session Messaging** — Send messages to active Devin sessions, view conversation history with markdown rendering
- **PR-Driven Columns** — Sessions with merged/closed PRs auto-move to Finished, open PRs stay in Idle
- **Finished Session Sidebar** — Click any finished session to view full details, messages, and PR status in a sidebar panel

### Claude Integration (optional — requires Claude CLI)
- **Orchestrator** — AI agent with access to board state, vault, Linear tickets, and session creation. Manages workflow across Devin and Claude
- **Child Sessions** — Spawn Claude Code sessions in any repo from the orchestrator or create modal
- **Pattern Injection** — Orchestrator automatically loads relevant vault patterns and prepends them to session prompts
- **Model/Effort Config** — Choose Sonnet, Opus, or Haiku with effort levels (low/medium/high/max) per session or as defaults

### Vault
- **Patterns** — Coding conventions with metadata (tags, repos, confidence). Matched to sessions by the orchestrator
- **Changelogs** — Auto-generated for both Devin and Claude sessions on completion. Devin changelogs include the last message summary
- **Session Records** — Full session history with prompts, results, tools used, and messages
- **Distillation** — Weekly maintenance cycle that extracts new patterns from changelogs, applies decay scoring, and archives stale content
- **Postgres-backed** — All vault data stored in local Postgres. GitHub vault used as fallback only

### Other
- **Feature Flags** — Claude, Linear, and Vault features auto-hidden when env vars aren't set. Works as a Devin-only dashboard with minimal config
- **Linear Integration** — View backlog tickets from a synced vault repo, launch Devin sessions directly
- **Knowledge Management** — Browse, create, edit Devin knowledge notes
- **Themes** — Alabaster (light), Navy (dark blue), Forest (dark green)
- **Performance** — Tab visibility polling pause, memo'd components, AbortController on all fetches, parallelized vault reads, merged PR cache

## Architecture

```
Browser → Next.js (localhost:3000)
              │
              ├── /api/devin/*        → Devin API (sessions, messages, knowledge)
              ├── /api/claude/*       → Claude Agent SDK (in-process sessions)
              ├── /api/vault/*        → Postgres (patterns, changelogs, records)
              ├── /api/orchestrator   → Claude orchestrator (in-process)
              ├── /api/config         → Feature flags from env vars
              └── /api/health         → Postgres + feature flag status
              
              Postgres (localhost:5432)
              ├── sessions            → Devin session cache
              ├── pr_cache            → GitHub PR status cache
              ├── vault_patterns      → Development patterns
              ├── vault_changelogs    → Session changelogs
              ├── vault_session_records → Completed session history
              ├── config_overrides    → Runtime config
              └── daily_metrics       → Aggregated stats
```

## Setup

```bash
git clone https://github.com/humzamujib/devin-mission-control.git
cd devin-mission-control
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

```
# Required
DEVIN_API_TOKEN=apk_user_...
NEXT_PUBLIC_DEVIN_USER_EMAIL=you@company.com
NEXT_PUBLIC_DEVIN_USER_NAME=Your Name
NEXT_PUBLIC_DEVIN_ENTERPRISE_URL=https://your-org.devinenterprise.com
GITHUB_TOKEN=gho_...

# Postgres (for vault persistence)
DATABASE_URL=postgresql://mission_control:localdev123@localhost:5432/mission_control
POSTGRES_ENABLED=true
POSTGRES_READ_ENABLED=true

# Optional — enables features when set
LINEAR_VAULT_REPO=owner/repo
LINEAR_SYNC_PLAYBOOK_ID=playbook-...
ANTHROPIC_API_KEY=              # or just have Claude CLI installed
```

### Postgres setup

```bash
# Install (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
createuser mission_control
createdb -O mission_control mission_control
psql -d mission_control -c "ALTER USER mission_control WITH PASSWORD 'localdev123';"
psql -U mission_control -d mission_control -f init.sql
```

### Seed vault (optional — if you have an existing GitHub vault)

```bash
npx tsx scripts/seed-vault.ts
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEVIN_API_TOKEN` | Yes | Devin API key |
| `GITHUB_TOKEN` | Yes | GitHub PAT for PR status enrichment |
| `NEXT_PUBLIC_DEVIN_USER_EMAIL` | Yes | Filters sessions to your email |
| `NEXT_PUBLIC_DEVIN_USER_NAME` | Yes | Display name |
| `NEXT_PUBLIC_DEVIN_ENTERPRISE_URL` | Yes | Base URL for Devin session links |
| `DATABASE_URL` | For Postgres | PostgreSQL connection string |
| `POSTGRES_ENABLED` | For Postgres | Enable writes to Postgres (`true`/`false`) |
| `POSTGRES_READ_ENABLED` | For Postgres | Enable reads from Postgres (`true`/`false`) |
| `LINEAR_VAULT_REPO` | For Linear/Vault | GitHub `owner/repo` for vault fallback + Linear tickets |
| `LINEAR_SYNC_PLAYBOOK_ID` | For Linear | Devin playbook that exports Linear tickets |
| `ANTHROPIC_API_KEY` | For Claude | Or just have Claude CLI installed and authenticated |

## Feature Flags

Features auto-enable based on which env vars are set:

| Feature | Requires |
|---------|----------|
| Devin sessions + Kanban | `DEVIN_API_TOKEN` |
| PR status enrichment | `GITHUB_TOKEN` |
| Claude orchestrator + sessions | Claude CLI installed or `ANTHROPIC_API_KEY` |
| Vault (patterns, changelogs) | `DATABASE_URL` + Postgres flags |
| Linear tickets | `LINEAR_VAULT_REPO` |

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19, TypeScript, Tailwind CSS 4
- PostgreSQL 15 (via node-pg)
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- Devin API (v1)
- GitHub API (PR enrichment, vault fallback)
