// Staff-session token storage + Authorization header injection.
// Imported for its side effect by main.tsx BEFORE any API call happens:
// it wraps window.fetch so every same-origin /api/* request carries the
// staff JWT. This keeps the generated tRPC provider untouched.

const TOKEN_KEY = "rbk.token";
const USER_KEY = "rbk.user";
const SERVER_URL_KEY = "rbk.server.url";

/** True inside the Capacitor Android shell (the native bridge injects this). */
export function isNativeApp(): boolean {
  try {
    return Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/**
 * API base for the Android APK. Empty = same-origin (normal web usage).
 * In the native shell the bundled page has no backend, so all /api/* calls
 * are rewritten to this base — the user enters it once on the login screen.
 */
export function getServerUrl(): string {
  try {
    return (localStorage.getItem(SERVER_URL_KEY) ?? "").replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function saveServerUrl(url: string) {
  try {
    const clean = url.trim().replace(/\/+$/, "");
    if (clean) localStorage.setItem(SERVER_URL_KEY, clean);
    else localStorage.removeItem(SERVER_URL_KEY);
  } catch {
    /* ignore */
  }
}

/** Rewrite relative /api/* URLs to the configured server base (native shell). */
export function apiUrl(url: string): string {
  const base = getServerUrl();
  if (base && url.startsWith("/api/")) return `${base}${url}`;
  return url;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session will not persist */
  }
}

export function getCachedUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveCachedUser(user: unknown | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const token = getToken();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url.startsWith("/api/")) {
    const rewritten = apiUrl(url);
    if (rewritten !== url) {
      input = rewritten;
    }
    if (token) {
      const headers = new Headers(
        input instanceof Request ? input.headers : init?.headers,
      );
      if (!headers.has("authorization")) {
        headers.set("authorization", `Bearer ${token}`);
      }
      init = { ...init, headers };
    }
  }
  return originalFetch(input, init);
};
