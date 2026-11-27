import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  AlertTriangle,
  Bell,
  Package,
  ShieldCheck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePerms } from "@/lib/perms";
import { timeAgo, useNotifications } from "@/lib/notifications";
import { formatNaira } from "@contracts/money";
import { formatQty } from "@contracts/stock";

const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 250;

export function NotificationBell() {
  const { has } = usePerms();
  const navigate = useNavigate();
  const { orders, approvals, lowStock, unreadOrders, markOrdersSeen, soundOn, toggleSound } =
    useNotifications();

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSeeAlerts = has("reports", "view");

  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const alerts = trpc.insights.generate.useQuery(
    { from: iso, to: iso },
    { enabled: canSeeAlerts, refetchInterval: 120_000 },
  );
  const alertItems = (alerts.data?.insights ?? []).filter(
    (i) => i.tone === "bad" || i.tone === "warn",
  );

  const badge = unreadOrders + approvals.length + lowStock.length + alertItems.length;

  // Opening the panel counts as "seen" for the unread-order badge.
  useEffect(() => {
    if (open) markOrdersSeen();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click (also unpins).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  function onEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  }

  function onLeave() {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => {
      if (!pinned) setOpen(false);
    }, HOVER_CLOSE_MS);
  }

  function onClick() {
    if (open && pinned) {
      setOpen(false);
      setPinned(false);
    } else {
      setOpen(true);
      setPinned(true);
    }
  }

  function go(path: string) {
    setOpen(false);
    setPinned(false);
    navigate(path);
  }

  return (
    <div className="relative" ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        onClick={onClick}
        data-testid="notif-bell"
        className="relative p-2 text-royal-dim transition-colors hover:text-royal-cream"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {badge > 0 && (
          <span
            data-testid="notif-badge"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notif-panel"
          className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] border border-royal-line bg-royal-panel shadow-2xl"
        >
          <p className="border-b border-royal-line px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-accent">
            Notifications
          </p>

          <div className="royal-scroll max-h-[26rem] overflow-y-auto">
            {/* New orders */}
            <div data-testid="notif-orders">
              <p className="border-b border-royal-line/60 px-4 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-royal-dim/80">
                New orders{orders.length > 0 ? ` · ${orders.length}` : ""}
              </p>
              {orders.length === 0 ? (
                <p className="px-4 py-4 text-xs text-royal-dim">No recent orders.</p>
              ) : (
                <div className="divide-y divide-royal-line/50">
                  {orders.slice(0, 10).map((o, idx) => {
                    const unread = idx < unreadOrders;
                    return (
                      <button
                        key={o.orderId}
                        type="button"
                        data-testid={`notif-order-${o.orderId}`}
                        onClick={() => go("/orders")}
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-royal-faint/30 ${
                          unread ? "bg-royal-accent/5" : ""
                        }`}
                      >
                        <UtensilsCrossed
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            unread ? "text-royal-accent" : "text-royal-dim/70"
                          }`}
                          strokeWidth={1.75}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={`truncate text-xs font-semibold ${
                                unread ? "text-royal-cream" : "text-royal-cream/80"
                              }`}
                            >
                              {o.orderNo} · {o.label}
                            </span>
                            <span className="shrink-0 text-[10px] text-royal-dim/80">
                              {timeAgo(o.createdAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] text-royal-dim">
                            {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                            {formatNaira(o.totalKobo)}
                            {o.staffName ? ` — ${o.staffName}` : ""}
                          </span>
                        </span>
                        {unread && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal-accent" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expenses waiting for approval (approvers only — server-gated) */}
            {approvals.length > 0 && (
              <div data-testid="notif-approvals">
                <p className="border-y border-royal-line/60 px-4 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-amber-300/90">
                  Awaiting approval · {approvals.length}
                </p>
                <div className="divide-y divide-royal-line/50">
                  {approvals.slice(0, 8).map((a) => (
                    <button
                      key={a.expenseId}
                      type="button"
                      data-testid={`notif-approval-${a.expenseId}`}
                      onClick={() => go("/money")}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-royal-faint/30"
                    >
                      <ShieldCheck
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300"
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-royal-cream">
                            {a.note}
                          </span>
                          <span className="shrink-0 text-[10px] text-royal-dim/80">
                            {timeAgo(a.expenseAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-royal-dim">
                          {formatNaira(a.amountKobo)} · {a.category}
                          {a.staffName ? ` — ${a.staffName}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Low stock (stock viewers only — server-gated) */}
            {lowStock.length > 0 && (
              <div data-testid="notif-lowstock">
                <p className="border-y border-royal-line/60 px-4 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-amber-300/90">
                  Low stock · {lowStock.length}
                </p>
                <div className="divide-y divide-royal-line/50">
                  {lowStock.slice(0, 8).map((s) => (
                    <button
                      key={s.itemId}
                      type="button"
                      data-testid={`notif-stock-${s.itemId}`}
                      onClick={() => go(`/stock/${s.itemId}`)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-royal-faint/30"
                    >
                      <Package
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300"
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-royal-cream">
                            {s.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-amber-300">
                            {formatQty(s.quantityMilli)} {s.unit} left
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-royal-dim">
                          alert at {formatQty(s.lowStockAtMilli)} {s.unit} — time to restock
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <NavLink
                  to="/stock"
                  onClick={() => {
                    setOpen(false);
                    setPinned(false);
                  }}
                  className="block border-t border-royal-line/60 px-4 py-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.25em] text-amber-300 transition-colors hover:bg-royal-faint/40"
                >
                  Open stock
                </NavLink>
              </div>
            )}

            {/* Insight alerts (reports viewers only — same rule as the old bell) */}
            {canSeeAlerts && (
              <div data-testid="notif-alerts">
                <p className="border-y border-royal-line/60 px-4 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-royal-dim/80">
                  Needs attention · today
                </p>
                {alertItems.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-royal-dim">
                    Nothing needs attention right now.
                  </p>
                ) : (
                  <div className="divide-y divide-royal-line/50">
                    {alertItems.map((i) => (
                      <div key={i.id} className="px-4 py-3" data-testid={`alert-${i.id}`}>
                        <p
                          className={`flex items-center gap-2 text-xs font-semibold ${
                            i.tone === "bad" ? "text-red-300" : "text-amber-300"
                          }`}
                        >
                          {i.tone === "bad" ? (
                            <XCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          )}
                          {i.title}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-royal-dim">{i.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <NavLink
                  to="/reports"
                  onClick={() => {
                    setOpen(false);
                    setPinned(false);
                  }}
                  className="block border-t border-royal-line/60 px-4 py-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.25em] text-royal-accent transition-colors hover:bg-royal-faint/40"
                >
                  Open reports
                </NavLink>
              </div>
            )}
          </div>

          {/* Footer: sound toggle */}
          <button
            type="button"
            data-testid="notif-sound-toggle"
            onClick={toggleSound}
            className="flex w-full items-center justify-center gap-2 border-t border-royal-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim transition-colors hover:bg-royal-faint/40 hover:text-royal-cream"
          >
            {soundOn ? (
              <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <VolumeX className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Sound {soundOn ? "on" : "off"}
          </button>
        </div>
      )}
    </div>
  );
}
