import { NextRequest } from "next/server";
import { syncSessionStatuses, bulkCorrectSessionStatuses } from "@/lib/pr-sync";
import { recordMetric } from "@/lib/repos/metrics-repo";

export async function GET(request: NextRequest) {
  try {
    // Check for authorization header for external cron services
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const userEmail = url.searchParams.get('user_email') || undefined;
    const bulkCorrect = url.searchParams.get('bulk_correct') === 'true';

    console.log(`[Cron PR Check] Starting automated sync`, { dryRun, userEmail, bulkCorrect });

    let syncResult;
    if (bulkCorrect) {
      // One-time bulk correction for mismatched sessions
      syncResult = await bulkCorrectSessionStatuses(dryRun);
    } else {
      // Regular synchronization
      syncResult = await syncSessionStatuses(userEmail, dryRun);
    }

    const result = {
      success: syncResult.errors.length === 0,
      timestamp: new Date().toISOString(),
      operation: bulkCorrect ? 'bulk_correct' : 'sync',
      dryRun,
      message: dryRun
        ? `[DRY RUN] Would update ${syncResult.sessionsUpdated} of ${syncResult.sessionsChecked} sessions`
        : `Updated ${syncResult.sessionsUpdated} of ${syncResult.sessionsChecked} sessions`,
      summary: {
        totalSessions: syncResult.totalSessions,
        sessionsChecked: syncResult.sessionsChecked,
        sessionsUpdated: syncResult.sessionsUpdated,
        errorCount: syncResult.errors.length
      },
      updates: syncResult.updates
        .filter(update => update.action !== "skip")
        .map(update => ({
          sessionId: update.sessionId,
          title: update.title,
          prUrl: update.prUrl,
          statusChange: `${update.oldStatus} → ${update.newStatus}`,
          reason: update.reason,
          success: update.success,
          error: update.error
        })),
      errors: syncResult.errors
    };

    console.log(`[Cron PR Check] Completed: ${syncResult.sessionsUpdated} sessions updated, ${syncResult.errors.length} errors`);

    // Fire-and-forget metric recording after sync completes
    if (!dryRun) {
      recordMetric(new Date(), 'pr_checks_run', 1).catch(console.error);
    }

    return Response.json(result, {
      status: syncResult.errors.length === 0 ? 200 : 207
    });

  } catch (error) {
    console.error("[Cron PR Check] Critical error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Also support POST for cron services that prefer it
  return GET(request);
}