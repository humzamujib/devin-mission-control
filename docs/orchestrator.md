# Mission Control Orchestrator

> The central AI agent that manages and coordinates Devin and Claude Code sessions across your development workflow.

## Overview

The Mission Control Orchestrator is an AI-powered workflow manager that helps developers coordinate multiple AI agents, track session progress, and manage development tasks across different repositories.

## Core Capabilities

### Session Management
- **Monitor Active Sessions**: Track all running Devin and Claude sessions with real-time status
- **Session Orchestration**: Create new sessions targeted at specific repos and tasks  
- **Progress Tracking**: Monitor session completion and identify stuck/idle sessions
- **Session History**: Access completed session records and outcomes from the vault

### Workflow Coordination
- **Linear Integration**: Pull actionable tickets from Linear backlog with priority filtering
- **PR Monitoring**: Track associated pull requests and their merge status (when implemented)
- **Task Prioritization**: Suggest next tasks based on context and dependencies
- **Cross-Agent Coordination**: Coordinate work between Devin and Claude sessions

### Knowledge Management
- **Vault Integration**: Read from and write to the ai-vault for patterns, changelogs, and insights
- **Session Records**: Automatically capture session outcomes and learnings
- **Pattern Recognition**: Surface relevant patterns and best practices for current tasks

## Key Features

### Board State Management
```typescript
// Current active sessions across all agents
{
  devin: [...], // Active Devin sessions
  claude: [...] // Active Claude SDK sessions  
}
```

### Ticket Management
- Fetches Linear tickets with filtering for actionable items
- Prioritizes by labels, assignee, and project context
- Suggests optimal ticket sequencing

### Vault Operations
- **Read**: Access patterns, changelogs, session history
- **Write**: Capture session summaries and knowledge
- **Browse**: Navigate vault directory structure

## Architecture

### Components
- **Orchestrator Core** (`src/lib/orchestrator.ts`): Main AI agent with tool access
- **Tool Layer** (`src/lib/orchestrator-tools.ts`): Mission Control MCP server integration
- **API Layer** (`src/app/api/orchestrator/route.ts`): RESTful endpoints for UI interaction
- **UI Layer** (`src/components/OrchestratorPanel.tsx`): Chat interface and controls

### Tool Integration
The orchestrator has access to specialized tools through the Mission Control MCP server:
- `get_board_state`: Session status across all agents
- `get_linear_tickets`: Actionable backlog items
- `create_devin_session` / `create_claude_session`: Spawn new agents
- `get_session_history`: Access completed session vault records
- `read_vault_file` / `write_vault_file`: Knowledge management
- `list_vault_directory`: Browse vault structure

## Usage Patterns

### Starting the Orchestrator
Two modes available:
1. **With Ticket Review**: Automatically checks board state and Linear tickets on start
2. **Manual Mode**: Starts clean, checks only when requested

### Common Workflows

#### 1. Daily Planning
```
1. Start orchestrator with ticket review enabled
2. Review board state and active sessions
3. Identify high-priority Linear tickets
4. Launch new sessions for selected tasks
5. Monitor progress throughout day
```

#### 2. Session Debugging
```
1. Check board state for stuck sessions
2. Investigate session history in vault
3. Use session interaction tools to recover
4. Document learnings for future
```

#### 3. Knowledge Capture
```
1. Complete development sessions
2. Write session summaries to vault
3. Extract patterns and best practices
4. Update relevant documentation
```

## Configuration

### Opt-in Behavior
By default, the orchestrator now starts in manual mode. Users can opt into automatic ticket review via the UI checkbox.

### System Prompt
The orchestrator is configured to:
- Be concise and actionable in responses
- Only check board state and tickets when explicitly requested (unless opted in)
- Prioritize workflow efficiency over comprehensive reporting
- Surface relevant vault knowledge contextually

## Troubleshooting

### Common Issues
1. **Stuck Sessions**: Use board state to identify, then session interaction tools to resolve
2. **Auth Issues**: Some Devin operations require organization-scoped API context
3. **State Sync**: UI may show different status than API - use manual refresh or session tools

### Monitoring
- Session status discrepancies between API and UI
- Failed session creation attempts  
- Vault read/write operations
- Linear API rate limiting

## Roadmap

### Planned Improvements
- **Automatic PR Monitoring**: Detect merged PRs and auto-finish sessions
- **Rich Session Details**: Show vault session records in UI instead of "nothing"
- **State Sync Fixes**: Resolve discrepancies between system status and UI
- **Advanced Filtering**: Smart ticket prioritization based on context and dependencies
- **Session Templates**: Pre-configured session types for common workflows

---

## Related Documentation
- [AI Vault Index](../vault-index.md) - Knowledge management system
- [Session Records](../sessions/) - Historical session outcomes
- [Development Patterns](../patterns/) - Best practices and conventions