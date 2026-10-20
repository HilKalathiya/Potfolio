// Safe localStorage helpers — every access wrapped in try/catch per CLAUDE.md
// (SPEC §4: human-view toggle and boot-skip choice both persist this way).
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, blocked, etc.) — fail silently
  }
}
