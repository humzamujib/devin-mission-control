"use client";

import { themes, type ThemeId } from "@/lib/themes";

type SettingsPanelProps = {
  currentTheme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
};

export default function SettingsPanel({
  currentTheme,
  onThemeChange,
}: SettingsPanelProps) {
  return (
    <div className="flex flex-1 items-start justify-center p-10">
      <div className="w-full max-w-lg">
        <h2 className="mb-6 text-lg font-semibold text-t-text-bright">
          Settings
        </h2>

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
                  <span className="ml-auto rounded-full bg-t-primary px-2 py-0.5 text-[10px] font-medium text-t-text-bright">
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
