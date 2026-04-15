import type { DevinSession } from "@/types";
import { listSessions, updateSessionStatus } from "@/lib/devin";
import { batchCheckPRStatuses, batchCheckPRsMerged } from "@/lib/github-pr";
import { normalizeSessionStatus } from "@/lib/session-state";

export type SessionUpdateResult = {
  sessionId: string;
  title?: string;
  prUrl?: string;
  oldStatus: string;
  newStatus: string;
  action: "sleep" | "block" | "skip";
  reason: string;
  success: boolean;
  error?: string;
};

export type PRSyncResult = {
  totalSessions: number;
  sessionsChecked: number;
  sessionsUpdated: number;
  updates: SessionUpdateResult[];
  errors: string[];
  prStatuses: Record<string, {
    merged: boolean;
    mergedAt: string | null;
    mergedBy: string | null;
  }>;
};

/**
 * Determines the target status for a session based on PR state and current status
 */
function determineTargetStatus(
  session: DevinSession,
  prMerged: boolean | undefined,
  prClosed: boolean | undefined
): { targetStatus: "finished" | "idle" | "blocked" | "skip"; reason: string } {
  const currentStatus = session.status_enum;
  const hasActivePR = !!session.pull_request?.url;
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  const timeSinceUpdate = Date.now() - new Date(session.updated_at).getTime();

  // Skip sessions that are already finished or stopped
  if (currentStatus === "finished" || currentStatus === "stopped") {
    return { targetStatus: "skip", reason: "Session already in terminal state" };
  }

  // Skip currently active sessions (let them continue working)
  if ((currentStatus === "working" || currentStatus === "running") &&
      timeSinceUpdate < 2 * 60 * 60 * 1000) { // Less than 2 hours since update
    return { targetStatus: "skip", reason: "Session is currently active" };
  }

  // ✅ PR is merged/closed + session sleeping → "finished" status
  if ((prMerged === true || prClosed === true) &&
      (currentStatus === "paused" || currentStatus === "blocked" ||
       timeSinceUpdate > 4 * 60 * 60 * 1000)) {
    return { targetStatus: "finished", reason: `PR ${prMerged ? 'merged' : 'closed'}, session can be finished` };
  }

  // 📝 PR is open + session sleeping → "idle" status
  if (hasActivePR && prMerged === false && prClosed === false &&
      (currentStatus === "paused" || currentStatus === "blocked" ||
       timeSinceUpdate > 4 * 60 * 60 * 1000)) {
    return { targetStatus: "idle", reason: "PR still open, session should be idle" };
  }

  // 🚫 External dependency → "blocked" status
  // Sessions without PRs that have been inactive for a while might be blocked
  if (!hasActivePR && timeSinceUpdate > 24 * 60 * 60 * 1000 &&
      (currentStatus === "paused" || currentStatus === "working" || currentStatus === "running")) {
    return { targetStatus: "blocked", reason: "No PR and inactive for >24h - likely blocked on external dependency" };
  }

  // Sessions that are very old and stuck should be finished
  if (sessionAge > 7 * 24 * 60 * 60 * 1000 && // Older than 7 days
      timeSinceUpdate > 24 * 60 * 60 * 1000) { // No activity for 24h
    return { targetStatus: "finished", reason: "Very old session with no recent activity" };
  }

  return { targetStatus: "skip", reason: "No status change needed" };
}

/**
 * Synchronize session statuses based on PR states
 */
export async function syncSessionStatuses(
  userEmail?: string,
  dryRun: boolean = false
): Promise<PRSyncResult> {
  const result: PRSyncResult = {
    totalSessions: 0,
    sessionsChecked: 0,
    sessionsUpdated: 0,
    updates: [],
    errors: [],
    prStatuses: {}
  };

  try {
    console.log("[PR Sync] Starting session status synchronization", { userEmail, dryRun });

    // Get all sessions
    const res = await listSessions(userEmail);
    if (!res.ok) {
      throw new Error(`Failed to fetch sessions: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const sessions = Array.isArray(data) ? data : data.sessions ?? [];
    result.totalSessions = sessions.length;

    console.log(`[PR Sync] Found ${sessions.length} total sessions`);

    // Filter sessions that need checking
    const sessionsToCheck = sessions.filter((s: DevinSession) => {
      // Check sessions that are not in terminal states
      return s.status_enum !== "finished" && s.status_enum !== "stopped";
    });

    result.sessionsChecked = sessionsToCheck.length;

    if (sessionsToCheck.length === 0) {
      console.log("[PR Sync] No sessions need status checking");
      return result;
    }

    // Get unique PR URLs for batch checking
    const prUrls = [...new Set(
      sessionsToCheck
        .filter((s: DevinSession) => s.pull_request?.url)
        .map((s: DevinSession) => s.pull_request!.url)
    )] as string[];

    console.log(`[PR Sync] Batch checking ${prUrls.length} unique PRs`);

    // Batch check PR statuses
    const prStatuses = prUrls.length > 0 ? await batchCheckPRStatuses(prUrls) : new Map();

    // Convert PR statuses for frontend compatibility
    const prStatusRecord: Record<string, { merged: boolean; mergedAt: string | null; mergedBy: string | null; }> = {};
    for (const [url, status] of prStatuses.entries()) {
      prStatusRecord[url] = {
        merged: status.merged,
        mergedAt: status.mergedAt,
        mergedBy: status.mergedBy
      };
    }
    result.prStatuses = prStatusRecord;

    // Process each session
    for (const session of sessionsToCheck) {
      const prUrl = session.pull_request?.url;
      const prStatus = prUrl ? prStatuses.get(prUrl) : undefined;

      const { targetStatus, reason } = determineTargetStatus(
        session,
        prStatus?.merged,
        prStatus?.closed
      );

      const updateResult: SessionUpdateResult = {
        sessionId: session.session_id,
        title: session.title,
        prUrl,
        oldStatus: session.status_enum,
        newStatus: targetStatus,
        action: targetStatus === "finished" || targetStatus === "idle" ? "sleep" :
                targetStatus === "blocked" ? "block" : "skip",
        reason,
        success: true
      };

      if (targetStatus === "skip") {
        result.updates.push(updateResult);
        continue;
      }

      if (!dryRun) {
        try {
          console.log(`[PR Sync] Updating session ${session.session_id}: ${session.status_enum} → ${targetStatus} (${reason})`);

          const response = await updateSessionStatus(session.session_id, targetStatus);

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }

          result.sessionsUpdated++;
          console.log(`[PR Sync] Successfully updated session ${session.session_id}`);

        } catch (error) {
          updateResult.success = false;
          updateResult.error = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to update session ${session.session_id}: ${updateResult.error}`);
          console.error(`[PR Sync] Failed to update session ${session.session_id}:`, error);
        }
      } else {
        console.log(`[PR Sync] [DRY RUN] Would update session ${session.session_id}: ${session.status_enum} → ${targetStatus} (${reason})`);
      }

      result.updates.push(updateResult);
    }

    console.log(`[PR Sync] Completed sync - ${result.sessionsUpdated} sessions updated, ${result.errors.length} errors`);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Sync failed: ${errorMessage}`);
    console.error("[PR Sync] Critical error:", error);
    return result;
  }
}

/**
 * Bulk correction for existing mismatched sessions
 * This is a one-time operation to fix all currently mismatched sessions
 */
export async function bulkCorrectSessionStatuses(dryRun: boolean = true): Promise<PRSyncResult> {
  console.log("[PR Sync] Starting bulk correction of mismatched sessions", { dryRun });

  // Run the full sync which will correct all mismatched sessions
  const result = await syncSessionStatuses(undefined, dryRun);

  // Filter results to show only sessions that needed updates
  result.updates = result.updates.filter(update => update.action !== "skip");

  console.log(`[PR Sync] Bulk correction completed - ${result.updates.length} sessions would be updated`);
  return result;
}