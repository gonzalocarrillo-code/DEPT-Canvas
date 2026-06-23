// Dark-first theme handling. <html class="dark"> is set in index.html so the very
// first paint is dark; this module reconciles a stored preference on boot and exposes
// a toggle. Full theme UI lands in P9.
export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "dept-canvas-theme";

function hasDom(): boolean {
  return typeof document !== "undefined";
}

export function getStoredTheme(): ThemeMode | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (!hasDom()) return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

/** Dark-first: stored preference wins, otherwise default to dark. */
export function bootstrapTheme(): ThemeMode {
  const mode = getStoredTheme() ?? "dark";
  applyTheme(mode);
  return mode;
}

export function setTheme(mode: ThemeMode): ThemeMode {
  applyTheme(mode);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  return mode;
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  return setTheme(next);
}
