"use client";

import { themes, type ThemeId } from "@/lib/themes";
import { MODELS, EFFORT_LEVELS } from "@/lib/model-config";

type SettingsPanelProps = {
  currentTheme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  defaultModel: string;
  onModelChange: (model: string) => void;
  defaultEffort: string;
  onEffortChange: (effort: string) => void;
  claudeEnabled?: boolean;
};

export default function SettingsPanel({
  currentTheme,
  onThemeChange,
  defaultModel,
  onModelChange,
  defaultEffort,
  onEffortChange,
  claudeEnabled = true,
}: SettingsPanelProps) {
  return (
    <div className="flex flex-1 items-start justify-center p-10">
      <div className="w-full max-w-lg">
        <h2 className="mb-6 text-lg font-semibold text-t-text-bright">
          Settings
        </h2>

        {/* Claude defaults */}
        {claudeEnabled && <div className="mb-8">
          <h3 className="mb-3 text-sm font-medium text-t-text-secondary">
            Claude Defaults
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-t-text-muted">
                Default Model
              </label>
              <select
                value={defaultModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-t-text-muted">
                Default Effort
              </label>
              <select
                value={defaultEffort}
                onChange={(e) => onEffortChange(e.target.value)}
                className="w-full rounded-md border border-t-border bg-t-bg px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
              >
                {EFFORT_LEVELS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>}

        <div>
          <h3 className="mb-3 text-sm font-medium text-t-text-secondary">
            Theme
          </h3>
          <div className="flex flex-col gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => onThemeChange(t.id)}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  currentTheme === t.id
                    ? "border-t-primary bg-t-primary/10"
                    : "border-t-border bg-t-surface hover:border-t-border-hover"
                }`}
              >
                {/* Color swatches */}
                <div className="flex gap-1">
                  {t.colors.map((c) => (
                    <div
                      key={c}
                      className="h-8 w-8 rounded-lg border border-white/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-t-text-bright">
                    {t.name}
                  </p>
                  <p className="text-xs text-t-text-muted">{t.source}</p>
                </div>
                {currentTheme === t.id && (
                  <span className="ml-auto rounded-full bg-t-primary px-2 py-0.5 text-[10px] font-medium text-white">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
