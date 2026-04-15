import { listSessions } from "@/lib/devin";
import { batchCheckPRsMerged } from "@/lib/github-pr";
import { syncSessionStatuses } from "@/lib/pr-sync";
import type { DevinSession } from "@/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const userEmail = url.searchParams.get('user_email') || undefined;
    const legacyMode = url.searchParams.get('legacy') === 'true';

    if (legacyMode) {
      // Legacy behavior: just check PR status without updating
      return await getLegacyPRStatus();
    }

    console.log(`[PR Monitor] Starting PR status synchronization`, { dryRun, userEmail });

    // Use the new sync service to perform intelligent status updates
    const syncResult = await syncSessionStatuses(userEmail, dryRun);

    // Transform results for backward compatibility
    const updatedSessions = syncResult.updates
      .filter(update => update.success && update.action !== "skip")
      .map(update => ({
        sessionId: update.sessionId,
        title: update.title,
        prUrl: update.prUrl,
        oldStatus: update.oldStatus,
        newStatus: update.newStatus,
        reason: update.reason
      }));

    const response = {
      message: dryRun
        ? `[DRY RUN] Would update ${syncResult.sessionsUpdated} sessions of ${syncResult.sessionsChecked} checked`
        : `Updated ${syncResult.sessionsUpdated} sessions of ${syncResult.sessionsChecked} checked`,
      checked: syncResult.sessionsChecked,
      updated: updatedSessions,
      total: syncResult.totalSessions,
      errors: syncResult.errors,
      dryRun,
      // Include PR statuses for frontend session normalization
      prStatuses: syncResult.prStatuses
    };

    if (syncResult.errors.length > 0) {
      console.warn(`[PR Monitor] Completed with ${syncResult.errors.length} errors:`, syncResult.errors);
      return Response.json(response, { status: 207 }); // Multi-status
    }

    console.log(`[PR Monitor] Successfully completed sync: ${syncResult.sessionsUpdated} sessions updated`);
    return Response.json(response);

  } catch (error) {
    console.error("[PR Monitor] Critical error:", error);
    return Response.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Legacy PR status checking (for backward compatibility)
async function getLegacyPRStatus() {
  const res = await listSessions();
  if (!res.ok) {
    return Response.json({ error: "Failed to fetch sessions" }, { status: res.status });
  }

  const data = await res.json();
  const sessions = Array.isArray(data) ? data : data.sessions ?? [];

  // Filter sessions with PR URLs that are not already finished/stopped
  const sessionsWithPRs = sessions.filter((s: DevinSession) => {
    return s.pull_request?.url &&
           (s.status_enum === "working" || s.status_enum === "running" || s.status_enum === "paused" || s.status_enum === "blocked");
  });

  if (sessionsWithPRs.length === 0) {
    return Response.json({
      message: "No sessions with PRs need status checking",
      updated: [],
      checked: 0
    });
  }

  // Extract unique PR URLs
  const prUrls = [...new Set(sessionsWithPRs.map((s: DevinSession) => s.pull_request!.url))] as string[];

  console.log(`[PR Monitor] [Legacy] Checking ${prUrls.length} unique PRs from ${sessionsWithPRs.length} sessions`);

  // Batch check PR merge status
  const prStatuses = await batchCheckPRsMerged(prUrls);

  // Find sessions with merged PRs
  const sessionsToUpdate = sessionsWithPRs.filter((s: DevinSession) => {
    const prStatus = prStatuses.get(s.pull_request!.url);
    return prStatus?.merged === true;
  });

  const updatedSessions = sessionsToUpdate.map((s: DevinSession) => {
    const prStatus = prStatuses.get(s.pull_request!.url);
    return {
      sessionId: s.session_id,
      title: s.title,
      prUrl: s.pull_request!.url,
      mergedAt: prStatus?.mergedAt,
      mergedBy: prStatus?.mergedBy
    };
  });

  return Response.json({
    message: `[Legacy] Checked ${prUrls.length} PRs, found ${updatedSessions.length} merged`,
    checked: prUrls.length,
    updated: updatedSessions,
    // Include raw PR status data for frontend use
    prStatuses: Object.fromEntries(prStatuses.entries())
  });
}