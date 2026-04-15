"use client";

import { useState } from "react";
import { validateSessionState, getSessionStateDescription } from "@/lib/session-state";
import type { DevinSession } from "@/types";

type SessionDiagnosticsProps = {
  sessions: DevinSession[];
  dismissedIds: Set<string>;
  onRefresh: () => void;
  onTerminate: (sessionId: string) => void;
  onWrapUp: (sessionId: string) => void;
};

type DiagnosticReport = {
  total_sessions: number;
  problematic_sessions: number;
  auto_recoverable: number;
  manual_intervention_needed: number;
  sessions: Array<{
    session: DevinSession;
    isDismissed: boolean;
    validation: ReturnType<typeof validateSessionState>;
    description: string;
  }>;
};

export default function SessionDiagnostics({
  sessions,
  dismissedIds,
  onRefresh,
  onTerminate,
  onWrapUp,
}: SessionDiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const runDiagnostics = () => {
    setIsRunning(true);
    setFeedback(null); // Clear any previous feedback

    const problematicSessions = [];
    let autoRecoverable = 0;
    let manualIntervention = 0;

    for (const session of sessions) {
      const isDismissed = dismissedIds.has(session.session_id);
      const validation = validateSessionState(session, isDismissed);

      if (!validation.isValid ||
          isDismissed !== (session.status_enum === "finished" || session.status_enum === "stopped")) {

        const description = getSessionStateDescription(validation);

        problematicSessions.push({
          session,
          isDismissed,
          validation,
          description,
        });

        if (validation.suggestedAction === "refresh" || validation.suggestedAction === "dismiss") {
          autoRecoverable++;
        } else if (validation.suggestedAction === "sleep" || validation.suggestedAction === "terminate") {
          manualIntervention++;
        }
      }
    }

    const diagnosticReport: DiagnosticReport = {
      total_sessions: sessions.length,
      problematic_sessions: problematicSessions.length,
      auto_recoverable: autoRecoverable,
      manual_intervention_needed: manualIntervention,
      sessions: problematicSessions.sort((a, b) =>
        new Date(b.session.updated_at).getTime() - new Date(a.session.updated_at).getTime()
      ),
    };

    setReport(diagnosticReport);
    setIsRunning(false);
  };

  const handleAutoFix = async () => {
    if (!report) return;

    setIsRunning(true);

    try {
      // Step 1: Run bulk correction to fix backend state mismatches
      console.log("Running bulk session status correction...");
      const bulkResponse = await fetch("/api/devin/sessions/bulk-correct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun: false }),
      });

      if (!bulkResponse.ok) {
        throw new Error(`Bulk correction failed: ${bulkResponse.statusText}`);
      }

      const bulkResult = await bulkResponse.json();
      console.log("Bulk correction result:", bulkResult);

      // Step 2: Handle frontend actions for issues that need UI-level fixes
      for (const item of report.sessions) {
        const { session, validation } = item;

        if (validation.suggestedAction === "refresh") {
          onRefresh();
        } else if (validation.suggestedAction === "dismiss") {
          onWrapUp(session.session_id);
        }
      }

      // Step 3: Wait a moment for backend changes to propagate, then refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      onRefresh();

      // Step 4: Re-run diagnostics after auto-fix
      setTimeout(runDiagnostics, 1000);

      setFeedback({
        type: 'success',
        message: `Auto-fix completed! Fixed ${bulkResult.summary?.sessionsCorrected || 0} sessions.`
      });

    } catch (error) {
      console.error("Auto-fix failed:", error);
      setFeedback({
        type: 'error',
        message: `Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setFeedback(null);
          runDiagnostics();
        }}
        className="fixed bottom-4 right-4 rounded-full bg-t-primary px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-t-primary-hover z-50"
        aria-label="Open session state diagnostics"
      >
        🩺 Diagnose State Issues
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="diagnostics-title">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-lg bg-t-bg border border-t-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-t-border px-6 py-4">
          <h2 id="diagnostics-title" className="text-lg font-semibold text-t-text-bright">
            Session State Diagnostics
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-t-text-muted hover:text-t-text-secondary"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Feedback messages */}
          {feedback && (
            <div className={`mb-4 p-3 rounded-lg border ${
              feedback.type === 'success'
                ? 'bg-t-success/10 border-t-success/30 text-t-success'
                : 'bg-t-error/10 border-t-error/30 text-t-error'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm">{feedback.message}</span>
                <button
                  onClick={() => setFeedback(null)}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {isRunning ? (
            <div className="text-center py-8">
              <div className="animate-spin mx-auto mb-4 h-8 w-8 border-2 border-t-primary border-r-transparent rounded-full"></div>
              <p className="text-t-text-muted">Running diagnostics...</p>
            </div>
          ) : report ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg border border-t-border bg-t-surface p-4">
                  <div className="text-2xl font-bold text-t-text-bright">{report.total_sessions}</div>
                  <div className="text-sm text-t-text-muted">Total Sessions</div>
                </div>
                <div className="rounded-lg border border-t-warning/30 bg-t-warning/10 p-4">
                  <div className="text-2xl font-bold text-t-warning">{report.problematic_sessions}</div>
                  <div className="text-sm text-t-text-muted">Issues Found</div>
                </div>
              </div>

              {report.problematic_sessions === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">✅</div>
                  <p className="text-lg text-t-text-bright mb-2">All Good!</p>
                  <p className="text-t-text-muted">No state synchronization issues detected.</p>
                </div>
              ) : (
                <>
                  {/* Auto-fix button */}
                  {report.auto_recoverable > 0 && (
                    <div className="mb-6">
                      <button
                        onClick={handleAutoFix}
                        disabled={isRunning}
                        className="w-full rounded-lg bg-t-success/20 border border-t-success/30 py-3 text-sm font-medium text-t-success hover:bg-t-success/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isRunning ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-t-success border-r-transparent rounded-full"></div>
                            Fixing issues...
                          </>
                        ) : (
                          <>
                            🔧 Auto-fix {report.auto_recoverable} recoverable issue{report.auto_recoverable !== 1 ? 's' : ''}
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Issues list */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-t-text-bright">Issues Detected:</h3>

                    {report.sessions.map(({ session, isDismissed, validation, description }) => (
                      <div
                        key={session.session_id}
                        className="rounded-lg border border-t-border bg-t-surface p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-t-text-bright">
                              {session.title || `Session ${session.session_id.slice(0, 8)}`}
                            </h4>
                            <p className="text-sm text-t-text-muted">
                              API: {session.status_enum} | UI: {isDismissed ? "idle" : session.status_enum}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {validation.suggestedAction === "sleep" && (
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/devin/sessions/${session.session_id}/sleep`, {
                                      method: "POST",
                                    });

                                    if (response.ok) {
                                      setFeedback({
                                        type: 'success',
                                        message: "Session put to sleep successfully"
                                      });
                                      onRefresh();
                                      setTimeout(runDiagnostics, 1000);
                                    } else {
                                      const error = await response.json();
                                      setFeedback({
                                        type: 'error',
                                        message: `Failed to sleep session: ${error.error || 'Unknown error'}`
                                      });
                                    }
                                  } catch (error) {
                                    setFeedback({
                                      type: 'error',
                                      message: `Failed to sleep session: ${error instanceof Error ? error.message : 'Unknown error'}`
                                    });
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-t-warning/20 text-t-warning rounded hover:bg-t-warning/30"
                              >
                                Sleep
                              </button>
                            )}
                            {validation.suggestedAction === "terminate" && (
                              <button
                                onClick={() => onTerminate(session.session_id)}
                                className="px-3 py-1 text-xs bg-t-error/20 text-t-error rounded"
                              >
                                Terminate
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-t-text-secondary">{description}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-t-border px-6 py-4 flex justify-between">
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="px-4 py-2 text-sm bg-t-primary text-white rounded hover:bg-t-primary-hover disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Re-run Diagnostics"}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm border border-t-border rounded hover:bg-t-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}