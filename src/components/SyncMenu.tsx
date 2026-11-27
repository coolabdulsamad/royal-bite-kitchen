import { useEffect, useRef, useState } from "react";
import { CloudOff, Cloud, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus, useOutbox, outboxStore, type OutboxEntry } from "@/lib/offline";
import { formatNaira } from "@contracts/money";
import { cn } from "@/lib/utils";

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function EntryRow({ entry }: { entry: OutboxEntry }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    await outboxStore.retry(entry.clientRef);
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold">{entry.localReceiptNo}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
              entry.status === "pending" && "bg-amber-100 text-amber-700",
              entry.status === "syncing" && "bg-blue-100 text-blue-700",
              entry.status === "failed" && "bg-rose-100 text-rose-700",
            )}
          >
            {entry.status}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {entry.payload.items.reduce((n, l) => n + l.quantity, 0)} item(s) · {formatNaira(entry.totalKobo)} ·{" "}
          {timeLabel(entry.createdAt)}
        </div>
        {entry.status === "failed" && entry.lastError ? (
          <div className="mt-0.5 text-xs text-rose-600">{entry.lastError}</div>
        ) : null}
      </div>
      {entry.status === "failed" ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void retry()}>
          <RefreshCw className={cn("mr-1 h-3.5 w-3.5", busy && "animate-spin")} />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Header pill + popover: connectivity state and offline sale outbox. */
export function SyncMenu() {
  const online = useOnlineStatus();
  const state = useOutbox();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Auto-sync when we come back online.
  useEffect(() => {
    if (online) void outboxStore.syncNow();
  }, [online]);

  const pending = state.entries.filter((e) => e.status !== "failed");
  const failed = state.entries.filter((e) => e.status === "failed");

  const pill = !online
    ? { cls: "border-amber-300 bg-amber-50 text-amber-800", label: "Offline" }
    : failed.length > 0
      ? { cls: "border-rose-300 bg-rose-50 text-rose-700", label: `${failed.length} failed` }
      : pending.length > 0
        ? { cls: "border-blue-300 bg-blue-50 text-blue-700", label: `${pending.length} to sync` }
        : { cls: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "Online" };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid="sync-pill"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold transition-colors sm:px-3",
          pill.cls,
        )}
        title={online ? "Connected" : "Offline — sales are saved on this device"}
      >
        {!online ? <WifiOff className="h-4 w-4" /> : pending.length > 0 ? <Cloud className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
        <span className="hidden sm:inline">{pill.label}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border bg-popover p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold">Sync status</div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            className={cn(
              "mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
              online ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
            {online
              ? "Connected — offline sales sync automatically."
              : "You're offline. New sales are saved on this device and sync when you're back."}
          </div>

          {state.entries.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Nothing waiting to sync.</div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {state.entries.map((e) => (
                <EntryRow key={e.clientRef} entry={e} />
              ))}
            </div>
          )}

          {state.lastSyncAt ? (
            <div className="mt-2 text-center text-xs text-muted-foreground">
              Last sync: {timeLabel(state.lastSyncAt)}
            </div>
          ) : null}

          {online && state.entries.length > 0 ? (
            <Button
              className="mt-2 w-full"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                await outboxStore.syncNow();
                setSyncing(false);
              }}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
              Sync now
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
