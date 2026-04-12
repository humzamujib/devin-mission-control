export type ThemeId = "alabaster" | "navy" | "forest";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  colors: [string, string, string, string];
  source: string;
};

export const themes: ThemeDef[] = [
  {
    id: "alabaster",
    name: "Alabaster",
    colors: ["#F5F3EE", "#D8D4CC", "#2B6CB0", "#133250"],
    source: "Warm neutral light — WCAG AA+",
  },
  {
    id: "navy",
    name: "Navy",
    colors: ["#112d4e", "#3f72af", "#dbe2ef", "#f9f7f7"],
    source: "https://colorhunt.co/palette/f9f7f7dbe2ef3f72af112d4e",
  },
  {
    id: "forest",
    name: "Forest",
    colors: ["#091413", "#285a48", "#408a71", "#b0e4cc"],
    source: "https://colorhunt.co/palette/091413285a48408a71b0e4cc",
  },
];

const STORAGE_KEY = "mc_theme";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "alabaster";
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) || "alabaster";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(STORAGE_KEY, id);
}
