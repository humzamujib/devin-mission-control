# PR Status Synchronization System

This document explains the automatic PR status synchronization system that fixes session status logic by keeping Devin sessions synchronized with GitHub PR states.

## Problem Statement

**BEFORE**: Too many sessions stuck in "Idle" column when they should be "finished"
- Sessions with merged PRs remained active or paused indefinitely
- No automatic transition based on actual GitHub PR status
- Manual intervention required for status updates

**AFTER**: Intelligent automatic status synchronization
- ✅ PR is merged/closed + session sleeping → "finished" status
- 📝 PR is open + session sleeping → "idle" status  
- 🚫 External dependency → "blocked" status
- ⚡ Currently active → "working" status (unchanged)

## Architecture

### Components

1. **PR Sync Service** (`/src/lib/pr-sync.ts`)
   - Core logic for determining target session status based on PR state
   - Batch processing with error handling
   - Dry-run capability for safe testing

2. **Enhanced GitHub Integration** (`/src/lib/github-pr.ts`)
   - Checks both merged and closed PR states
   - Rate-limited batch processing (100ms delays)
   - Comprehensive PR status information

3. **Devin API Extensions** (`/src/lib/devin.ts`)
   - Session status update capabilities
   - Uses existing sleep/terminate endpoints for state transitions

4. **API Endpoints**
   - `/api/devin/sessions/pr-status` - Real-time synchronization
   - `/api/devin/sessions/bulk-correct` - One-time bulk fixes
   - `/api/devin/sessions/status-dashboard` - System health overview
   - `/api/cron/pr-check` - Automated periodic sync

## API Reference

### 1. Real-time PR Status Sync

**Endpoint**: `GET/POST /api/devin/sessions/pr-status`

**Query Parameters**:
- `dry_run=true` - Preview changes without updating (default: false)
- `user_email=user@example.com` - Filter to specific user
- `legacy=true` - Use old behavior (status check only, no updates)

**Example**:
```bash
# Dry run to see what would be updated
curl "http://localhost:3000/api/devin/sessions/pr-status?dry_run=true"

# Actually perform updates
curl "http://localhost:3000/api/devin/sessions/pr-status"

# Filter to specific user
curl "http://localhost:3000/api/devin/sessions/pr-status?user_email=john@company.com"
```

**Response**:
```json
{
  "message": "Updated 3 sessions of 15 checked",
  "checked": 15,
  "updated": [
    {
      "sessionId": "abc123",
      "title": "Fix user login bug",
      "prUrl": "https://github.com/company/repo/pull/123",
      "oldStatus": "paused",
      "newStatus": "finished",
      "reason": "PR merged, session can be finished"
    }
  ],
  "total": 25,
  "errors": [],
  "dryRun": false
}
```

### 2. Bulk Correction

**Endpoint**: `GET/POST /api/devin/sessions/bulk-correct`

**Purpose**: One-time operation to fix all existing mismatched sessions

**POST Body**:
```json
{
  "dryRun": true  // Set to false to actually perform corrections
}
```

**Examples**:
```bash
# Check what would be corrected (GET method)
curl "http://localhost:3000/api/devin/sessions/bulk-correct"

# Dry run correction (POST with dryRun: true)
curl -X POST "http://localhost:3000/api/devin/sessions/bulk-correct" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Actually perform bulk correction
curl -X POST "http://localhost:3000/api/devin/sessions/bulk-correct" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

### 3. Status Dashboard

**Endpoint**: `GET /api/devin/sessions/status-dashboard`

**Query Parameters**:
- `user_email=user@example.com` - Filter to specific user
- `check_prs=false` - Skip PR status checking for faster response

**Example**:
```bash
curl "http://localhost:3000/api/devin/sessions/status-dashboard"
```

**Response**:
```json
{
  "timestamp": "2026-04-13T10:30:00.000Z",
  "summary": {
    "totalSessions": 25,
    "statusDistribution": {
      "working": 5,
      "finished": 15,
      "paused": 3,
      "blocked": 2
    },
    "prStatistics": {
      "sessionsWithPRs": 18,
      "sessionsWithOpenPRs": 8,
      "sessionsWithMergedPRs": 10,
      "sessionsWithoutPRs": 7
    },
    "healthScore": 92
  },
  "issues": {
    "totalIssues": 2,
    "mismatchedPRStates": 2,
    "stuckSessions": 0,
    "oldActiveSessions": 0
  },
  "recommendations": [
    {
      "priority": "high",
      "issue": "PR Status Mismatch",
      "count": 2,
      "description": "Sessions with merged PRs should be finished",
      "action": "Run bulk correction to sync session statuses with PR states"
    }
  ]
}
```

### 4. Automated Cron Sync

**Endpoint**: `GET/POST /api/cron/pr-check`

**Headers**: `Authorization: Bearer <CRON_SECRET>` (if CRON_SECRET env var is set)

**Query Parameters**:
- `dry_run=true` - Preview mode
- `user_email=user@example.com` - Filter to specific user  
- `bulk_correct=true` - Perform bulk correction instead of regular sync

**Examples**:
```bash
# Regular automated sync
curl -H "Authorization: Bearer your-cron-secret" \
  "http://localhost:3000/api/cron/pr-check"

# Bulk correction via cron
curl -H "Authorization: Bearer your-cron-secret" \
  "http://localhost:3000/api/cron/pr-check?bulk_correct=true"

# Dry run via cron
curl -H "Authorization: Bearer your-cron-secret" \
  "http://localhost:3000/api/cron/pr-check?dry_run=true"
```

## Setup Instructions

### 1. Environment Variables

Ensure these environment variables are set:

```env
# Required
DEVIN_API_TOKEN=your-devin-token
GITHUB_TOKEN=your-github-token

# Optional - for external cron services
CRON_SECRET=your-cron-secret
```

### 2. Test the System

1. **Check current status**:
   ```bash
   curl "http://localhost:3000/api/devin/sessions/status-dashboard"
   ```

2. **Run dry-run bulk correction** to see what would be fixed:
   ```bash
   curl -X POST "http://localhost:3000/api/devin/sessions/bulk-correct" \
     -H "Content-Type: application/json" \
     -d '{"dryRun": true}'
   ```

3. **Perform actual bulk correction** (if needed):
   ```bash
   curl -X POST "http://localhost:3000/api/devin/sessions/bulk-correct" \
     -H "Content-Type: application/json" \
     -d '{"dryRun": false}'
   ```

### 3. Set Up Automated Sync

#### Option A: External Cron Service (Recommended)

Use a service like [EasyCron](https://www.easycron.com/) or similar:

- **URL**: `https://your-domain.com/api/cron/pr-check`
- **Method**: GET or POST
- **Headers**: `Authorization: Bearer your-cron-secret`
- **Frequency**: Every 10-15 minutes
- **Timeout**: 60 seconds

#### Option B: GitHub Actions

Create `.github/workflows/pr-sync.yml`:

```yaml
name: PR Status Sync
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync PR Status
        run: |
          curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.MISSION_CONTROL_URL }}/api/cron/pr-check"
```

#### Option C: Serverless Function

Deploy a simple serverless function that calls the cron endpoint on a schedule.

## Status Transition Logic

The system follows this decision tree:

```
For each session:

1. Is session already finished/stopped?
   → SKIP (no action needed)

2. Is session currently active (working/running) and updated <2h ago?
   → SKIP (let it continue working)

3. Does session have a PR?
   
   YES:
   - Is PR merged or closed?
     → FINISHED (sleep the session)
   - Is PR still open and session inactive >4h?
     → IDLE (sleep the session, UI shows as idle)
   
   NO:
   - Is session inactive >24h?
     → BLOCKED (likely waiting on external dependency)
   - Is session very old (>7 days) and inactive >24h?
     → FINISHED (probably abandoned)

4. Otherwise → SKIP (no change needed)
```

## Monitoring and Troubleshooting

### Health Checks

Monitor these metrics:

1. **Health Score** from status dashboard (should be >90%)
2. **Mismatched PR States** count (should be near 0 after sync)
3. **Sync Errors** (should be minimal)

### Common Issues

1. **High number of mismatched states**
   - Run bulk correction
   - Check if cron sync is working

2. **GitHub API rate limiting**
   - Verify GITHUB_TOKEN is set and valid
   - Check rate limits: 5000 req/hour for authenticated users
   - System includes 100ms delays to prevent hitting limits

3. **Devin API errors**
   - Verify DEVIN_API_TOKEN is set and valid
   - Check Devin API status

4. **Sessions not updating**
   - Check if sessions are actually inactive (not just appearing inactive)
   - Verify PR URLs are valid and accessible
   - Check logs for specific errors

### Logs

Monitor these log patterns:

- `[PR Sync]` - Main synchronization operations
- `[Bulk Correct]` - Bulk correction operations  
- `[Status Dashboard]` - Dashboard generation
- `[Cron PR Check]` - Automated sync operations

## Migration Guide

### From Manual Status Management

1. **Backup**: Document current session states (optional)
2. **Test**: Run status dashboard to see current state
3. **Dry Run**: Execute bulk correction in dry-run mode
4. **Correct**: Run actual bulk correction
5. **Monitor**: Set up automated sync
6. **Validate**: Check status dashboard after 24 hours

### Rollback Plan

If needed, disable automated sync by:
1. Remove/disable cron jobs
2. Use legacy mode: add `?legacy=true` to PR status endpoint
3. Manual session management through Devin interface

## Performance Considerations

- **GitHub API**: 5000 requests/hour limit with delays
- **Devin API**: No specific limits known, system includes error handling
- **Batch Processing**: Processes 100 sessions efficiently
- **Frontend Impact**: Minimal - existing polling continues unchanged

The system is designed to be robust and safe, with extensive dry-run capabilities and error handling.