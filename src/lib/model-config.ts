export const MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Opus 4" },
  { id: "claude-haiku-4-20250514", label: "Haiku 4" },
] as const;

export const EFFORT_LEVELS = ["low", "medium", "high", "max"] as const;

export const DEFAULT_MODEL = MODELS[0].id;
export const DEFAULT_EFFORT = "high";

const STORAGE_KEY_MODEL = "mc_default_model";
const STORAGE_KEY_EFFORT = "mc_default_effort";

export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL;
}

export function setStoredModel(model: string) {
  localStorage.setItem(STORAGE_KEY_MODEL, model);
}

export function getStoredEffort(): string {
  if (typeof window === "undefined") return DEFAULT_EFFORT;
  return localStorage.getItem(STORAGE_KEY_EFFORT) || DEFAULT_EFFORT;
}

export function setStoredEffort(effort: string) {
  localStorage.setItem(STORAGE_KEY_EFFORT, effort);
}
