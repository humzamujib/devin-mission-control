import { listSessions } from "@/lib/devin";
import { validateSessionState, shouldCleanupDismissedSession, normalizeSessionStatus } from "@/lib/session-state";
import type { NextRequest } from "next/server";
import type { DevinSession } from "@/types";

function isPullRequestValid(value: unknown): value is DevinSession["pull_request"] {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;

  const pr = value as Record<string, unknown>;
  return typeof pr.url === "string" &&
    (pr.merged === undefined || typeof pr.merged === "boolean") &&
    (pr.merged_at === undefined || pr.merged_at === null || typeof pr.merged_at === "string") &&
    (pr.merged_by === undefined || pr.merged_by === null || typeof pr.merged_by === "string");
}

function isStructuredOutputValid(value: unknown): value is DevinSession["structured_output"] {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;

  const output = value as Record<string, unknown>;
  return (output.title === undefined || typeof output.title === "string") &&
    (output.summary === undefined || typeof output.summary === "string");
}

type SessionDiagnostic = {
  session_id: string;
  title: string;
  api_status: string;
  ui_status: string;
  is_dismissed: boolean;
  validation: ReturnType<typeof validateSessionState>;
  suggested_actions: string[];
  last_updated: string;
  session_age_hours: number;
};

type DiagnosticReport = {
  total_sessions: number;
  problematic_sessions: number;
  auto_recoverable: number;
  manual_intervention_needed: number;
  sessions: SessionDiagnostic[];
  summary: {
    stuck_sessions: number;
    state_mismatches: number;
    old_dismissed: number;
    auth_failures: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    const userEmail = request.nextUrl.searchParams.get("user_email") || undefined;
    // const autoFix = request.nextUrl.searchParams.get("auto_fix") === "true";

    // Fetch sessions from API
    const res = await listSessions(userEmail);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return Response.json(
        { error: data.detail || `API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const sessions: DevinSession[] = (Array.isArray(data) ? data : data.sessions ?? [])
      .map((s: Record<string, unknown>) => normalizeSession(s));

    // Get dismissed sessions from localStorage (this would need to be passed from client)
    // For now, we'll work with what we have
    const dismissedIds = new Set<string>();

    const diagnostics: SessionDiagnostic[] = [];
    const summary = {
      stuck_sessions: 0,
      state_mismatches: 0,
      old_dismissed: 0,
      auth_failures: 0,
    };

    for (const session of sessions) {
      const isDismissed = dismissedIds.has(session.session_id);
      const validation = validateSessionState(session, isDismissed);

      const sessionAge = Date.now() - new Date(session.created_at).getTime();
      const sessionAgeHours = sessionAge / (60 * 60 * 1000);

      const suggestedActions: string[] = [];

      // Determine suggested actions
      if (!validation.isValid) {
        if (validation.suggestedAction) {
          suggestedActions.push(validation.suggestedAction);
        }

        // Count issues
        if (validation.suggestedAction === "sleep" || validation.suggestedAction === "terminate") {
          summary.stuck_sessions++;
        }
        if (validation.actualStatus !== session.status_enum) {
          summary.state_mismatches++;
        }
        if (isDismissed && shouldCleanupDismissedSession(session)) {
          summary.old_dismissed++;
        }
      }

      const diagnostic: SessionDiagnostic = {
        session_id: session.session_id,
        title: session.title || `Session ${session.session_id.slice(0, 8)}`,
        api_status: session.status_enum,
        ui_status: isDismissed ? "idle" : session.status_enum,
        is_dismissed: isDismissed,
        validation,
        suggested_actions: suggestedActions,
        last_updated: session.updated_at,
        session_age_hours: Math.round(sessionAgeHours * 10) / 10,
      };

      // Only include problematic sessions in the report
      if (!validation.isValid || isDismissed !== (validation.actualStatus === "finished")) {
        diagnostics.push(diagnostic);
      }
    }

    const report: DiagnosticReport = {
      total_sessions: sessions.length,
      problematic_sessions: diagnostics.length,
      auto_recoverable: diagnostics.filter(d =>
        d.suggested_actions.includes("dismiss") || d.suggested_actions.includes("refresh")
      ).length,
      manual_intervention_needed: diagnostics.filter(d =>
        d.suggested_actions.includes("sleep") || d.suggested_actions.includes("terminate")
      ).length,
      sessions: diagnostics.sort((a, b) =>
        new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
      ),
      summary,
    };

    // If auto-fix is enabled, we could perform automatic recovery here
    // For now, just return the diagnostic report

    return Response.json(report);

  } catch (error) {
    console.error("Session diagnosis error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Diagnosis failed" },
      { status: 500 }
    );
  }
}

function normalizeSession(raw: Record<string, unknown>): DevinSession {
  const status = typeof raw.status === "string" ? raw.status : "unknown";
  const apiStatusEnum = typeof raw.status_enum === "string" ? raw.status_enum : "";
  const statusEnum = normalizeSessionStatus(status, apiStatusEnum, typeof raw.updated_at === "string" ? raw.updated_at : undefined);

  return {
    session_id: (typeof raw.session_id === "string" ? raw.session_id : typeof raw.devin_id === "string" ? raw.devin_id : ""),
    title: typeof raw.title === "string" ? raw.title : undefined,
    status,
    status_enum: statusEnum,
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : (typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString()),
    url: typeof raw.url === "string" ? raw.url : undefined,
    requesting_user_email: typeof raw.requesting_user_email === "string" ? raw.requesting_user_email : undefined,
    tags: Array.isArray(raw.tags) && raw.tags.every((t): t is string => typeof t === "string") ? raw.tags : undefined,
    pull_request: isPullRequestValid(raw.pull_request) ? raw.pull_request : undefined,
    structured_output: isStructuredOutputValid(raw.structured_output) ? raw.structured_output : undefined,
  };
}