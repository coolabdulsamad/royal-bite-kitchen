import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@contracts/money";
import { armSoundUnlock, isSoundOn, playApprovalBlip, playOrderChime, setSoundOn } from "@/lib/sound";
import { formatQty } from "@contracts/stock";

/** Toasts live 8 minutes (the user asked for a 5–10 min window) unless dismissed. */
export const TOAST_TTL_MS = 8 * 60 * 1000;
const MAX_TOASTS = 5;
const POLL_MS = 15_000;

export interface OrderToast {
  id: string;
  kind: "order" | "approval" | "stock";
  title: string;
  body: string;
  href: string;
  createdAt: number;
}

export interface FeedOrder {
  orderId: number;
  orderNo: string;
  status: string;
  label: string;
  source: string;
  totalKobo: number;
  staffId: number;
  staffName: string | null;
  createdAt: string;
  itemCount: number;
  itemsPreview: string[];
}

export interface FeedApproval {
  expenseId: number;
  note: string;
  category: string;
  amountKobo: number;
  staffName: string | null;
  expenseAt: string;
}

export interface FeedLowStock {
  itemId: number;
  name: string;
  unit: string;
  quantityMilli: number;
  lowStockAtMilli: number;
}

interface NotificationsValue {
  toasts: OrderToast[];
  dismiss: (id: string) => void;
  open: (t: OrderToast) => void;
  orders: FeedOrder[];
  approvals: FeedApproval[];
  lowStock: FeedLowStock[];
  unreadOrders: number;
  markOrdersSeen: () => void;
  soundOn: boolean;
  toggleSound: () => void;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}

function seenKey(userId: number) {
  return `rbk.seen.order.${userId}`;
}

export function timeAgo(iso: string | number): string {
  const ms = typeof iso === "number" ? iso : new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const feed = trpc.notifications.feed.useQuery(undefined, {
    refetchInterval: POLL_MS,
    // The bell + toasts care about freshness, not retries stacking up.
    retry: 1,
  });

  const [toasts, setToasts] = useState<OrderToast[]>([]);
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  const [lastSeenOrderId, setLastSeenOrderId] = useState<number | null>(null);

  // Ids already notified (or baselined) — toasts fire exactly once per entity.
  const knownOrders = useRef<Set<number>>(new Set());
  const knownApprovals = useRef<Set<number>>(new Set());
  // Low stock is a STATE, not an event: the set holds the previous feed's low
  // ids, so an item that recovers and drops low again re-alerts.
  const prevLowStock = useRef<Set<number>>(new Set());
  const baselined = useRef(false);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Unlock the AudioContext on the first user gesture (browser policy).
  useEffect(() => armSoundUnlock(), []);

  // Clear everything when the logged-in user changes (shared terminal).
  useEffect(() => {
    knownOrders.current = new Set();
    knownApprovals.current = new Set();
    prevLowStock.current = new Set();
    baselined.current = false;
    setToasts([]);
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = new Map();
    if (user) {
      const stored = Number(localStorage.getItem(seenKey(user.id)) ?? "0");
      setLastSeenOrderId(Number.isFinite(stored) ? stored : 0);
    } else {
      setLastSeenOrderId(null);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const pushToast = useCallback(
    (t: OrderToast) => {
      setToasts((prev) => {
        if (prev.some((x) => x.id === t.id)) return prev;
        return [t, ...prev].slice(0, MAX_TOASTS);
      });
      const timer = setTimeout(() => dismiss(t.id), TOAST_TTL_MS);
      timers.current.set(t.id, timer);
    },
    [dismiss],
  );

  const orders: FeedOrder[] = useMemo(
    () => (feed.data?.orders ?? []) as FeedOrder[],
    [feed.data],
  );
  const approvals: FeedApproval[] = useMemo(
    () => (feed.data?.pendingExpenses ?? []) as FeedApproval[],
    [feed.data],
  );
  const lowStock: FeedLowStock[] = useMemo(
    () => (feed.data?.lowStock ?? []) as FeedLowStock[],
    [feed.data],
  );

  // Diff each fresh feed: first load is the silent baseline, afterwards every
  // genuinely new id pops a toast (+ chime for orders, blip for approvals).
  useEffect(() => {
    if (!feed.data || !user) return;
    const currentLow = new Set(lowStock.map((s) => s.itemId));
    if (!baselined.current) {
      knownOrders.current = new Set(orders.map((o) => o.orderId));
      knownApprovals.current = new Set(approvals.map((a) => a.expenseId));
      prevLowStock.current = currentLow;
      baselined.current = true;
      // First visit on this device: never show a huge "unread" pile from
      // before the user even opened the app.
      if ((localStorage.getItem(seenKey(user.id)) ?? null) === null && orders.length > 0) {
        const maxId = Math.max(...orders.map((o) => o.orderId));
        localStorage.setItem(seenKey(user.id), String(maxId));
        setLastSeenOrderId(maxId);
      }
      return;
    }
    for (const o of orders) {
      if (knownOrders.current.has(o.orderId)) continue;
      knownOrders.current.add(o.orderId);
      if (o.staffId === user.id) continue; // you placed it — you know
      const items = o.itemCount > 0 ? `${o.itemCount} item${o.itemCount === 1 ? "" : "s"}` : "items";
      pushToast({
        id: `order-${o.orderId}`,
        kind: "order",
        title: `New order · ${o.orderNo}`,
        body: `${o.label} · ${items} · ${formatNaira(o.totalKobo)}${o.staffName ? ` — ${o.staffName}` : ""}`,
        href: "/orders",
        createdAt: Date.now(),
      });
      playOrderChime();
    }
    for (const a of approvals) {
      if (knownApprovals.current.has(a.expenseId)) continue;
      knownApprovals.current.add(a.expenseId);
      pushToast({
        id: `approval-${a.expenseId}`,
        kind: "approval",
        title: "Expense waiting for approval",
        body: `${a.note} · ${formatNaira(a.amountKobo)}${a.staffName ? ` — ${a.staffName}` : ""}`,
        href: "/money",
        createdAt: Date.now(),
      });
      playApprovalBlip();
    }
    // Newly low items (weren't low in the previous feed).
    for (const s of lowStock) {
      if (prevLowStock.current.has(s.itemId)) continue;
      pushToast({
        id: `stock-${s.itemId}-${Date.now()}`,
        kind: "stock",
        title: `Low stock · ${s.name}`,
        body: `${formatQty(s.quantityMilli)} ${s.unit} left — alert at ${formatQty(s.lowStockAtMilli)} ${s.unit}`,
        href: `/stock/${s.itemId}`,
        createdAt: Date.now(),
      });
      playApprovalBlip();
    }
    prevLowStock.current = currentLow;
  }, [feed.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadOrders = useMemo(() => {
    if (lastSeenOrderId === null) return 0;
    return orders.filter((o) => o.orderId > lastSeenOrderId).length;
  }, [orders, lastSeenOrderId]);

  const markOrdersSeen = useCallback(() => {
    if (!user || orders.length === 0) return;
    const maxId = Math.max(...orders.map((o) => o.orderId));
    localStorage.setItem(seenKey(user.id), String(maxId));
    setLastSeenOrderId(maxId);
  }, [user, orders]);

  const open = useCallback(
    (t: OrderToast) => {
      dismiss(t.id);
      navigate(t.href);
    },
    [dismiss, navigate],
  );

  const toggleSound = useCallback(() => {
    setSoundOnState((prev) => {
      setSoundOn(!prev);
      return !prev;
    });
  }, []);

  const value: NotificationsValue = {
    toasts,
    dismiss,
    open,
    orders,
    approvals,
    lowStock,
    unreadOrders,
    markOrdersSeen,
    soundOn,
    toggleSound,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
