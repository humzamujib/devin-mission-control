# GitHub PR Status Monitoring

This feature automatically monitors GitHub Pull Request (PR) status for Devin sessions and transitions sessions from active states to "finished" when their associated PR gets merged.

## Features

- **Automatic PR Status Checking**: Monitors PRs linked to Devin sessions
- **Auto-transition**: Sessions automatically move to "finished" when PR is merged
- **Merge Status Display**: Shows merge status and timestamp in session cards
- **Rate Limit Handling**: Includes proper rate limiting for GitHub API calls
- **Background Jobs**: Periodic PR status checking every 2 minutes
- **Manual Testing**: Script for manual PR status checks

## Setup

### 1. Environment Variables

The GitHub API integration uses the existing `GITHUB_TOKEN` environment variable. Optionally, set up a cron secret for external job scheduling:

```bash
# Required (already configured for other features)
GITHUB_TOKEN=gho_your_token_here

# Optional: For securing external cron jobs
CRON_SECRET=your-secret-key-here
```

### 2. GitHub Token Permissions

Your `GITHUB_TOKEN` needs the following permissions:
- `repo` scope for private repositories
- `public_repo` scope for public repositories

## How It Works

### 1. PR Detection

The system automatically detects sessions with PR URLs in the format:
```
https://github.com/owner/repo/pull/123
```

### 2. Status Monitoring

- **Frontend Polling**: Checks PR status every 2 minutes during normal operation
- **Session Polling**: Regular session polling (15 seconds) incorporates PR data
- **External Cron**: Optional external cron job for server-side monitoring

### 3. Auto-transition Logic

Sessions are automatically transitioned to "finished" when:
- The session has a PR URL
- The session status is "working", "running", or "paused" 
- The associated PR is merged

### 4. UI Updates

Session cards display:
- ✓ **PR merged** badge for merged PRs
- **PR ready** badge for open PRs in idle sessions
- **PR #123** for other active PRs
- Merge timestamp ("Merged 2h ago")

## API Endpoints

### GET `/api/devin/sessions/pr-status`

Checks PR merge status for all active sessions.

**Response:**
```json
{
  "message": "Checked 3 PRs, found 1 merged",
  "checked": 3,
  "updated": [
    {
      "sessionId": "session_123",
      "title": "Fix user authentication",
      "prUrl": "https://github.com/owner/repo/pull/456",
      "mergedAt": "2024-04-13T15:30:00Z",
      "mergedBy": "developer"
    }
  ],
  "prStatuses": {
    "https://github.com/owner/repo/pull/456": {
      "merged": true,
      "mergedAt": "2024-04-13T15:30:00Z",
      "mergedBy": "developer"
    }
  }
}
```

### GET/POST `/api/cron/pr-check`

Cron-friendly endpoint for external scheduling services.

**Headers:**
```
Authorization: Bearer your-cron-secret
```

## Manual Testing

Use the provided script to manually test PR status checking:

```bash
# Test against local development server
node scripts/check-pr-status.js

# Test against custom URL
node scripts/check-pr-status.js --local-url=https://your-app.com
```

## External Cron Setup

### Using GitHub Actions (Recommended)

Create `.github/workflows/pr-check.yml`:

```yaml
name: PR Status Check
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  pr-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check PR Status
        run: |
          curl -X POST "https://your-app.com/api/cron/pr-check" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### Using External Cron Services

Many platforms support HTTP cron jobs:

- **Vercel Cron**: Add to `vercel.json`
- **Railway Cron**: Use Railway's cron service
- **EasyCron**: Configure HTTP GET/POST request
- **cron-job.org**: Free HTTP cron service

Example cron job:
```bash
# Every 5 minutes
*/5 * * * * curl -X POST "https://your-app.com/api/cron/pr-check" -H "Authorization: Bearer YOUR_SECRET"
```

## Rate Limiting

The system includes built-in rate limiting:

- **100ms delay** between consecutive API calls
- **GitHub limits**: 5,000 requests/hour for authenticated users
- **Smart batching**: Only checks unique PR URLs
- **Error handling**: Graceful fallback on rate limit errors

## Error Handling

The system handles common error cases:

- **404 PR Not Found**: Logs warning, continues processing
- **403 Rate Limited**: Logs warning, skips check
- **Network errors**: Logs error, continues with other PRs
- **Invalid PR URLs**: Ignores malformed URLs

## Troubleshooting

### Sessions not transitioning

1. Check that `GITHUB_TOKEN` has correct permissions
2. Verify PR URL format is correct
3. Check browser console for error messages
4. Test manually: `node scripts/check-pr-status.js`

### GitHub API rate limits

1. Verify you're using an authenticated token
2. Check GitHub API rate limit headers
3. Consider reducing check frequency for large teams

### PR status not updating

1. Check that the session has the correct PR URL
2. Verify the PR is actually merged on GitHub
3. Check network tab for API call failures
4. Ensure frontend is polling regularly (check console logs)

## Technical Details

### Database Schema Changes

The feature extends existing types:

```typescript
// DevinSession type
pull_request?: {
  url: string;
  merged?: boolean;
  merged_at?: string | null;
  merged_by?: string | null;
} | null;

// BoardCard type
pull_request_merged?: boolean;
pull_request_merged_at?: string | null;
```

### Performance Considerations

- **Batch processing**: Multiple PR URLs checked in single operation
- **Caching**: Frontend caches PR status between polling intervals
- **Selective checking**: Only checks sessions in active states
- **Minimal payload**: Only returns essential data

## Future Enhancements

Potential improvements:

1. **Webhook support**: Real-time PR status via GitHub webhooks
2. **PR status history**: Track PR status changes over time  
3. **Team notifications**: Slack/Discord notifications for merged PRs
4. **Advanced filtering**: Filter by repository, author, etc.
5. **Analytics**: Track PR merge times and productivity metrics