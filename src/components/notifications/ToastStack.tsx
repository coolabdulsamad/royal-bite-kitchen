import { ShieldCheck, UtensilsCrossed, X } from "lucide-react";
import { TOAST_TTL_MS, timeAgo, useNotifications, type OrderToast } from "@/lib/notifications";

function ToastCard({ toast }: { toast: OrderToast }) {
  const { dismiss, open } = useNotifications();
  const isOrder = toast.kind === "order";

  return (
    <div
      data-testid={`toast-${toast.id}`}
      className="toast-enter relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden border border-royal-line bg-royal-panel shadow-2xl"
      role="status"
    >
      {/* Accent rail */}
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          isOrder ? "bg-royal-accent" : "bg-amber-400"
        }`}
      />
      <button
        type="button"
        onClick={() => open(toast)}
        className="flex w-full items-start gap-3 px-4 pb-3 pl-5 pt-3.5 text-left transition-colors hover:bg-royal-faint/30"
      >
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border ${
            isOrder
              ? "border-royal-accent/40 bg-royal-accent/15 text-royal-accent"
              : "border-amber-400/40 bg-amber-400/10 text-amber-300"
          }`}
        >
          {isOrder ? (
            <UtensilsCrossed className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-royal-cream">
              {toast.title}
            </span>
            <span className="shrink-0 text-[10px] text-royal-dim/80">
              {timeAgo(toast.createdAt)}
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-royal-dim">
            {toast.body}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        title="Dismiss"
        data-testid={`toast-dismiss-${toast.id}`}
        onClick={() => dismiss(toast.id)}
        className="absolute right-2 top-2 p-1 text-royal-dim/70 transition-colors hover:text-royal-cream"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {/* Lifetime bar — empties over TOAST_TTL_MS, then the toast auto-dismisses */}
      <span
        className={`toast-life absolute bottom-0 left-0 h-0.5 w-full origin-left ${
          isOrder ? "bg-royal-accent/70" : "bg-amber-400/70"
        }`}
        style={{ animationDuration: `${TOAST_TTL_MS}ms` }}
      />
    </div>
  );
}

export function ToastStack() {
  const { toasts } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-stack"
      className="pointer-events-auto fixed right-4 top-20 z-[70] flex flex-col gap-3"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
