import { NextRequest } from "next/server";
import { listSessions } from "@/lib/devin";
import { batchCheckPRStatuses } from "@/lib/github-pr";
import { validateSessionState, normalizeSessionStatus } from "@/lib/session-state";
import type { DevinSession } from "@/types";

/**
 * Session status dashboard - provides comprehensive overview of session states
 * and PR synchronization status
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('user_email') || undefined;
    const includePRCheck = url.searchParams.get('check_prs') !== 'false';

    console.log(`[Status Dashboard] Generating status overview`, { userEmail, includePRCheck });

    // Get all sessions
    const res = await listSessions(userEmail);
    if (!res.ok) {
      throw new Error(`Failed to fetch sessions: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const sessions = Array.isArray(data) ? data : data.sessions ?? [];

    // Basic session statistics
    const statusCounts = sessions.reduce((acc: Record<string, number>, session: DevinSession) => {
      const status = session.status_enum || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // PR-related statistics
    const prStats = {
      sessionsWithPRs: 0,
      sessionsWithOpenPRs: 0,
      sessionsWithMergedPRs: 0,
      sessionsWithoutPRs: 0
    };

    let prStatuses = new Map();

    if (includePRCheck) {
      // Check PR statuses for sessions with PRs
      const sessionsWithPRs = sessions.filter((s: DevinSession) => s.pull_request?.url);
      const prUrls = [...new Set(sessionsWithPRs.map((s: DevinSession) => s.pull_request!.url))] as string[];

      if (prUrls.length > 0) {
        console.log(`[Status Dashboard] Checking ${prUrls.length} unique PRs`);
        prStatuses = await batchCheckPRStatuses(prUrls);
      }
    }

    // Analyze session states and identify issues
    const sessionAnalysis = sessions.map((session: DevinSession) => {
      const prUrl = session.pull_request?.url;
      const prStatus = prUrl ? prStatuses.get(prUrl) : undefined;

      // Update PR stats
      if (prUrl) {
        prStats.sessionsWithPRs++;
        if (prStatus?.merged) {
          prStats.sessionsWithMergedPRs++;
        } else if (prStatus?.state === 'open') {
          prStats.sessionsWithOpenPRs++;
        }
      } else {
        prStats.sessionsWithoutPRs++;
      }

      // Validate session state
      const validation = validateSessionState(session);

      return {
        sessionId: session.session_id,
        title: session.title,
        currentStatus: session.status_enum,
        prUrl: prUrl,
        prState: prStatus?.state || null,
        prMerged: prStatus?.merged || null,
        isValidState: validation.isValid,
        suggestedAction: validation.suggestedAction || null,
        stateReason: validation.reason || null,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        age: Date.now() - new Date(session.created_at).getTime(),
        timeSinceUpdate: Date.now() - new Date(session.updated_at).getTime()
      };
    });

    // Identify problematic sessions
    const issues = {
      stuckSessions: sessionAnalysis.filter((s: any) => !s.isValidState && s.suggestedAction === 'sleep'),
      mismatchedPRStates: sessionAnalysis.filter((s: any) =>
        s.prMerged === true &&
        (s.currentStatus === 'working' || s.currentStatus === 'running' || s.currentStatus === 'paused' || s.currentStatus === 'blocked')
      ),
      oldActiveSessions: sessionAnalysis.filter((s: any) =>
        (s.currentStatus === 'working' || s.currentStatus === 'running') &&
        s.timeSinceUpdate > 4 * 60 * 60 * 1000 // No activity for 4+ hours
      ),
      dismissablesSessions: sessionAnalysis.filter((s: any) =>
        !s.isValidState && s.suggestedAction === 'dismiss'
      )
    };

    // Generate recommendations
    const recommendations = [];

    if (issues.mismatchedPRStates.length > 0) {
      recommendations.push({
        priority: 'high',
        issue: 'PR Status Mismatch',
        count: issues.mismatchedPRStates.length,
        description: 'Sessions with merged PRs should be finished',
        action: 'Run bulk correction to sync session statuses with PR states'
      });
    }

    if (issues.stuckSessions.length > 0) {
      recommendations.push({
        priority: 'medium',
        issue: 'Stuck Sessions',
        count: issues.stuckSessions.length,
        description: 'Sessions appear to be stuck and inactive',
        action: 'Review and put stuck sessions to sleep or terminate'
      });
    }

    if (issues.oldActiveSessions.length > 0) {
      recommendations.push({
        priority: 'medium',
        issue: 'Old Active Sessions',
        count: issues.oldActiveSessions.length,
        description: 'Sessions marked as active but no recent activity',
        action: 'Check if these sessions are actually still working'
      });
    }

    const dashboard = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSessions: sessions.length,
        statusDistribution: statusCounts,
        prStatistics: prStats,
        healthScore: Math.round((sessions.length - issues.mismatchedPRStates.length - issues.stuckSessions.length) / sessions.length * 100)
      },
      issues: {
        totalIssues: issues.mismatchedPRStates.length + issues.stuckSessions.length + issues.oldActiveSessions.length,
        stuckSessions: issues.stuckSessions.length,
        mismatchedPRStates: issues.mismatchedPRStates.length,
        oldActiveSessions: issues.oldActiveSessions.length,
        dismissableSessions: issues.dismissablesSessions.length
      },
      recommendations,
      detailedAnalysis: includePRCheck ? sessionAnalysis : undefined,
      actions: {
        bulkCorrect: {
          endpoint: '/api/devin/sessions/bulk-correct',
          description: 'Fix all mismatched session statuses based on PR states'
        },
        syncStatuses: {
          endpoint: '/api/devin/sessions/pr-status',
          description: 'Sync session statuses with current PR states'
        },
        cronSetup: {
          endpoint: '/api/cron/pr-check',
          description: 'Automated periodic synchronization'
        }
      }
    };

    console.log(`[Status Dashboard] Generated dashboard: ${sessions.length} sessions, ${dashboard.issues.totalIssues} issues`);
    return Response.json(dashboard);

  } catch (error) {
    console.error("[Status Dashboard] Error generating dashboard:", error);
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