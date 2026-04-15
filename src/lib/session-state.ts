import type { DevinSession, SessionStatus } from "@/types";

export type SessionStateValidation = {
  isValid: boolean;
  actualStatus: SessionStatus;
  suggestedAction?: "refresh" | "terminate" | "sleep" | "dismiss";
  reason?: string;
};

/**
 * Validates session state and suggests corrective actions
 * Now considers PR status when determining if a session should be marked as finished vs idle
 */
export function validateSessionState(
  session: DevinSession,
  isDismissed: boolean = false
): SessionStateValidation {
  const now = Date.now();
  const updatedAt = new Date(session.updated_at).getTime();
  const createdAt = new Date(session.created_at).getTime();
  const sessionAge = now - createdAt;
  const timeSinceUpdate = now - updatedAt;

  // Define time thresholds
  const ONE_HOUR = 60 * 60 * 1000;
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // Helper function to determine if session has an open PR
  const hasOpenPR = (session: DevinSession): boolean => {
    return !!(session.pull_request?.url && !session.pull_request?.merged);
  };

  // Check for obviously finished sessions
  if (session.status_enum === "finished" || session.status_enum === "stopped") {
    return {
      isValid: true,
      actualStatus: session.status_enum,
      suggestedAction: isDismissed ? "dismiss" : undefined,
      reason: "Session is properly marked as completed"
    };
  }

  // Check for stuck sessions
  if (
    (session.status_enum === "working" || session.status_enum === "running") &&
    timeSinceUpdate > FOUR_HOURS
  ) {
    // If session has an open PR, it should be idle (may need more work), not finished
    const actualStatus = hasOpenPR(session) ? "paused" : "finished";
    const statusReason = hasOpenPR(session)
      ? "Session appears stuck but has open PR - may need attention"
      : "Session appears stuck - likely finished but not properly updated";

    return {
      isValid: false,
      actualStatus,
      suggestedAction: "sleep",
      reason: `${statusReason} - no updates for ${Math.round(timeSinceUpdate / ONE_HOUR)} hours`
    };
  }

  // Check for very old sessions that should be finished
  if (sessionAge > ONE_DAY && session.status_enum !== "blocked") {
    // If session has an open PR, it should be idle (may need more work), not finished
    const actualStatus = hasOpenPR(session) ? "paused" : "finished";
    const statusReason = hasOpenPR(session)
      ? "Session is very old but has open PR - may need attention"
      : "Session is very old and should likely be finished";
    const suggestedAction = hasOpenPR(session) ? "dismiss" : "terminate";

    return {
      isValid: false,
      actualStatus,
      suggestedAction,
      reason: statusReason
    };
  }

  // Check for blocked sessions without recent activity
  if (session.status_enum === "blocked" && timeSinceUpdate > ONE_DAY) {
    // If blocked session has an open PR, it should remain idle, not finished
    const actualStatus = hasOpenPR(session) ? "paused" : "finished";
    const statusReason = hasOpenPR(session)
      ? "Blocked session has open PR but been inactive - may need attention"
      : "Blocked session has been inactive for too long";
    const suggestedAction = hasOpenPR(session) ? "dismiss" : "terminate";

    return {
      isValid: false,
      actualStatus,
      suggestedAction,
      reason: statusReason
    };
  }

  // Check for dismissed sessions that are actually active
  if (
    isDismissed &&
    (session.status_enum === "working" || session.status_enum === "running") &&
    timeSinceUpdate < ONE_HOUR
  ) {
    return {
      isValid: false,
      actualStatus: session.status_enum,
      suggestedAction: "refresh",
      reason: "Dismissed session is actually still active"
    };
  }

  return {
    isValid: true,
    actualStatus: session.status_enum,
    reason: "Session state appears normal"
  };
}

/**
 * Determines if a session should be automatically cleaned from dismissed list
 * Now more careful with sessions that have open PRs
 */
export function shouldCleanupDismissedSession(
  session: DevinSession,
  dismissedAge: number = 0
): boolean {
  const ONE_HOUR = 60 * 60 * 1000;
  const TWELVE_HOURS = 12 * ONE_HOUR;
  const timeSinceUpdate = Date.now() - new Date(session.updated_at).getTime();

  const hasOpenPR = !!(session.pull_request?.url && !session.pull_request?.merged);

  // Always cleanup finished/stopped sessions without PRs immediately
  if ((session.status_enum === "finished" || session.status_enum === "stopped") && !session.pull_request) {
    return true;
  }

  // Cleanup finished sessions with merged PRs after 1 hour
  if ((session.status_enum === "finished" || session.status_enum === "stopped") &&
      session.pull_request?.merged && dismissedAge > ONE_HOUR) {
    return true;
  }

  // Be more conservative with sessions that have open PRs - wait longer before cleanup
  if (hasOpenPR) {
    // Only cleanup sessions with open PRs if they've been dismissed for >12 hours AND inactive for >24 hours
    return dismissedAge > TWELVE_HOURS && timeSinceUpdate > 24 * 60 * 60 * 1000;
  }

  // Cleanup very old inactive sessions (without open PRs)
  if (timeSinceUpdate > 24 * 60 * 60 * 1000) {
    return true;
  }

  return false;
}

/**
 * Enhanced status normalization with better edge case handling
 * Now considers PR status when determining if old sessions should be idle vs finished
 */
export function normalizeSessionStatus(
  rawStatus: string | undefined,
  rawStatusEnum: string | undefined,
  updatedAt?: string,
  hasOpenPR?: boolean
): SessionStatus {
  const status = (rawStatus || "").toLowerCase().trim();
  const statusEnum = (rawStatusEnum || "").toLowerCase().trim();

  // Use the most specific status available
  const combinedStatus = statusEnum || status || "";

  // Comprehensive mapping
  if (combinedStatus.match(/^(working|running|active|in_progress)$/)) {
    return "working";
  }

  if (combinedStatus.match(/^(paused|suspended|waiting|wait)$/)) {
    return "paused";
  }

  if (combinedStatus.match(/^(blocked|needs_input|waiting_for_input)$/)) {
    return "blocked";
  }

  if (combinedStatus.match(/^(finished|completed|done|success|successful)$/)) {
    return "finished";
  }

  if (combinedStatus.match(/^(stopped|failed|error|terminated|killed|cancelled|aborted)$/)) {
    return "stopped";
  }

  if (combinedStatus.includes("idle")) {
    return "paused";
  }

  // Fallback logic based on age if status is unclear
  if (updatedAt) {
    const age = Date.now() - new Date(updatedAt).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (age > oneDay) {
      // If session has an open PR, it should be paused (shows as idle) instead of finished
      return hasOpenPR ? "paused" : "finished";
    }
  }

  return "unknown";
}

/**
 * Get a human-readable description of session state issues
 */
export function getSessionStateDescription(validation: SessionStateValidation): string {
  if (validation.isValid) {
    return "Session state is synchronized";
  }

  const action = validation.suggestedAction;
  const reason = validation.reason || "Unknown issue";

  switch (action) {
    case "refresh":
      return `${reason}. Try refreshing the session data.`;
    case "sleep":
      return `${reason}. Consider putting the session to sleep.`;
    case "terminate":
      return `${reason}. Consider terminating the session.`;
    case "dismiss":
      return `${reason}. Session can be safely dismissed.`;
    default:
      return reason;
  }
}