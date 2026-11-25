import { useSyncExternalStore } from "react";

let online = typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    online = true;
    emit();
  });
  window.addEventListener("offline", () => {
    online = false;
    emit();
  });
}

export function isOnline(): boolean {
  return online;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => online,
  );
}

/** Quick reachability probe with timeout — more reliable than navigator.onLine. */
export async function pingServer(timeoutMs = 4000): Promise<boolean> {
  if (!online) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    await globalThis.fetch("/api/trpc/auth.whoami?input=%7B%22json%22%3Anull%7D", {
      credentials: "include",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return true; // any HTTP response means the API is reachable
  } catch {
    return false;
  }
}
