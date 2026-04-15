import { NextRequest } from "next/server";
import { bulkCorrectSessionStatuses } from "@/lib/pr-sync";

/**
 * Bulk correction endpoint for fixing all mismatched session statuses
 * This is a one-time operation to fix existing issues
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun ?? true; // Default to dry run for safety

    console.log(`[Bulk Correct] Starting bulk session correction`, { dryRun });

    const syncResult = await bulkCorrectSessionStatuses(dryRun);

    const response = {
      success: syncResult.errors.length === 0,
      message: dryRun
        ? `[DRY RUN] Would correct ${syncResult.updates.length} mismatched sessions`
        : `Corrected ${syncResult.sessionsUpdated} of ${syncResult.updates.length} mismatched sessions`,
      dryRun,
      timestamp: new Date().toISOString(),
      summary: {
        totalSessions: syncResult.totalSessions,
        sessionsChecked: syncResult.sessionsChecked,
        mismatchedSessions: syncResult.updates.length,
        sessionsCorrected: syncResult.sessionsUpdated,
        errorCount: syncResult.errors.length
      },
      corrections: syncResult.updates.map(update => ({
        sessionId: update.sessionId,
        title: update.title,
        prUrl: update.prUrl,
        statusChange: `${update.oldStatus} → ${update.newStatus}`,
        reason: update.reason,
        action: update.action,
        success: update.success,
        error: update.error
      })),
      errors: syncResult.errors
    };

    console.log(`[Bulk Correct] Completed: ${syncResult.updates.length} mismatches found, ${syncResult.sessionsUpdated} corrected`);

    return Response.json(response, {
      status: syncResult.errors.length === 0 ? 200 : 207
    });

  } catch (error) {
    console.error("[Bulk Correct] Critical error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET method for status report - shows what would be corrected without actually doing it
 */
export async function GET() {
  try {
    console.log(`[Bulk Correct] Generating status report`);

    const syncResult = await bulkCorrectSessionStatuses(true); // Always dry run for GET

    const report = {
      message: `Found ${syncResult.updates.length} sessions with status mismatches`,
      timestamp: new Date().toISOString(),
      summary: {
        totalSessions: syncResult.totalSessions,
        sessionsChecked: syncResult.sessionsChecked,
        mismatchedSessions: syncResult.updates.length,
        categories: {
          shouldBeFinished: syncResult.updates.filter(u => u.newStatus === "finished").length,
          shouldBeIdle: syncResult.updates.filter(u => u.newStatus === "idle").length,
          shouldBeBlocked: syncResult.updates.filter(u => u.newStatus === "blocked").length
        }
      },
      mismatches: syncResult.updates.map(update => ({
        sessionId: update.sessionId,
        title: update.title,
        prUrl: update.prUrl,
        currentStatus: update.oldStatus,
        shouldBe: update.newStatus,
        reason: update.reason,
        action: update.action
      }))
    };

    console.log(`[Bulk Correct] Status report: ${syncResult.updates.length} mismatches found`);
    return Response.json(report);

  } catch (error) {
    console.error("[Bulk Correct] Error generating status report:", error);
    return Response.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}