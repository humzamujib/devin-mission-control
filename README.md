# Mission Control

A lightweight Kanban dashboard for managing your Devin AI coding sessions.

## Features

- **Kanban Board** — Sessions organized into Queued, Running, Needs Input, Idle, and Finished columns with live polling
- **Multi-PR Support** — Sessions track multiple PRs; a session moves to Finished only when all PRs are merged/closed
- **Session Messaging** — Send messages to active Devin sessions and view conversation history
- **Split View** — Open multiple sessions side-by-side with three layout modes: board, split, focus
- **Themes** — Alabaster (light), Navy (dark blue), Forest (dark green)

## Setup

```bash
git clone https://github.com/humzamujib/devin-mission-control.git
cd devin-mission-control
npm install
cp .env.local.example .env.local
```

Edit `.env.local` with your three required values:

```
DEVIN_API_TOKEN=apk_user_...
NEXT_PUBLIC_DEVIN_USER_EMAIL=you@company.com
NEXT_PUBLIC_DEVIN_ENTERPRISE_URL=https://your-org.devinenterprise.com
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEVIN_API_TOKEN` | **Yes** | Devin API key |
| `NEXT_PUBLIC_DEVIN_USER_EMAIL` | **Yes** | Filters sessions to your email |
| `NEXT_PUBLIC_DEVIN_ENTERPRISE_URL` | **Yes** | Base URL for Devin session links |
| `GITHUB_TOKEN` | No | GitHub PAT — enables PR status badges on session cards |
| `NEXT_PUBLIC_DEVIN_USER_NAME` | No | Display name (only needed with advanced features) |

## Advanced Features

### Claude Integration

Setting `ANTHROPIC_API_KEY` unlocks two additional capabilities:

**Orchestrator** — An AI agent that has visibility into your full board state. It can read session statuses, reason across multiple sessions, and spawn new Devin sessions on your behalf. Accessible via the Orchestrator tab.

**Claude Sessions** — Fire off Claude Code sessions directly from the "+ New Session" modal alongside Devin sessions. Claude sessions run in a repo of your choice and appear on the Kanban board like any other session. Useful for parallelizing work across both agents.

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19, TypeScript, Tailwind CSS 4
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- Devin API (v1)
- GitHub API (PR status enrichment)
