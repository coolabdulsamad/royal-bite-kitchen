import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";
import { usePerms } from "@/lib/perms";
import {
  printDrawerSheet,
  printExpenses,
  printTerminalTakings,
} from "@/lib/printMoney";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";
const dateCls =
  "border-b border-royal-line bg-transparent px-1 py-1.5 text-xs text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none";
const chipCls = (active: boolean) =>
  `rounded-full border px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
    active
      ? "border-royal-accent bg-royal-accent text-royal-bg"
      : "border-royal-line text-royal-dim hover:border-royal-accent hover:text-royal-accent"
  }`;

const EXPENSE_CATEGORIES = [
  "supplies",
  "utilities",
  "wages",
  "rent",
  "transport",
  "equipment",
  "other",
] as const;

// ---------------------------------------------------------------------------
// Date-range helpers (server-local days — the API parses YYYY-MM-DD the same)
// ---------------------------------------------------------------------------

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type RangePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";

const PRESET_LABEL: Record<RangePreset, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  "7d": "7 days",
  "30d": "30 days",
  custom: "Custom",
};

function presetToRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  const t = todayIso();
  switch (preset) {
    case "all":
      return {};
    case "today":
      return { from: t, to: t };
    case "yesterday": {
      const y = shiftDays(t, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: shiftDays(t, -6), to: t };
    case "30d":
      return { from: shiftDays(t, -29), to: t };
    case "custom":
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
      };
  }
}

function rangeLabel(preset: RangePreset, from?: string, to?: string): string {
  if (preset === "custom") {
    if (from && to) return from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
    if (from) return `From ${fmtDay(from)}`;
    if (to) return `Until ${fmtDay(to)}`;
    return "Custom range";
  }
  return PRESET_LABEL[preset];
}

function RangeChips({
  preset,
  onPreset,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
  allowAll = false,
  testidBase,
}: {
  preset: RangePreset;
  onPreset: (p: RangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  allowAll?: boolean;
  testidBase: string;
}) {
  const presets: RangePreset[] = allowAll
    ? ["all", "today", "yesterday", "7d", "30d", "custom"]
    : ["today", "yesterday", "7d", "30d", "custom"];
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`${testidBase}-range`}>
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          className={chipCls(preset === p)}
          onClick={() => onPreset(p)}
          data-testid={`${testidBase}-range-${p}`}
        >
          {PRESET_LABEL[p]}
        </button>
      ))}
      {preset === "custom" && (
        <span className="flex items-center gap-2">
          <input
            type="date"
            className={dateCls}
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            data-testid={`${testidBase}-from`}
          />
          <span className="text-xs text-royal-dim">→</span>
          <input
            type="date"
            className={dateCls}
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            data-testid={`${testidBase}-to`}
          />
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cash drawer
// ---------------------------------------------------------------------------

function CashDrawerSection({ canView, canManage }: { canView: boolean; canManage: boolean }) {
  const utils = trpc.useUtils();
  const [preset, setPreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = presetToRange(preset, customFrom, customTo);
  const label = rangeLabel(preset, range.from, range.to);
  const isToday = preset === "today";

  const summary = trpc.money.drawer.summary.useQuery(range, {
    refetchInterval: 60_000,
  });
  const counts = trpc.money.drawer.counts.useQuery(
    { limit: 50, ...range },
    { enabled: canView },
  );

  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{
    countedKobo: number;
    expectedKobo: number;
    diffKobo: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countMutation = trpc.money.drawer.count.useMutation({
    onSuccess: async (r) => {
      setResult(r);
      setCounted("");
      setNote("");
      setError(null);
      // Cancel-then-invalidate (see refresh() below for why plain
      // invalidate is not enough while the mount batch is in flight).
      await Promise.all([
        utils.money.drawer.summary.cancel(),
        utils.money.drawer.counts.cancel(),
      ]);
      utils.money.drawer.summary.invalidate();
      utils.money.drawer.counts.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  function handleCount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const amount = Number(counted);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter the counted amount in naira.");
      return;
    }
    countMutation.mutate({ counted: amount, note: note || undefined });
  }

  function handlePrint() {
    if (!summary.data) return;
    printDrawerSheet(summary.data, counts.data?.counts ?? [], label);
  }

  const s = summary.data;

  return (
    <section className="border border-royal-line bg-royal-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          <Scale className="h-4 w-4" strokeWidth={2} />
          Cash drawer · {label}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <RangeChips
            preset={preset}
            onPreset={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
            testidBase="drawer"
          />
          <button
            type="button"
            onClick={handlePrint}
            disabled={!s}
            className="flex items-center gap-2 rounded-full border border-royal-line px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-50"
            data-testid="drawer-print"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={2} />
            Print
          </button>
        </div>
      </div>

      {summary.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-royal-line px-4 py-3">
            <p className={labelCls}>Cash sales</p>
            <p className="mt-1 text-lg font-bold text-royal-cream" data-testid="drawer-sales">
              {formatNaira(s?.cashSalesKobo ?? 0)}
            </p>
          </div>
          <div className="border border-royal-line px-4 py-3">
            <p className={labelCls}>Cash repayments</p>
            <p className="mt-1 text-lg font-bold text-royal-cream" data-testid="drawer-repayments">
              {formatNaira(s?.cashRepaymentsKobo ?? 0)}
            </p>
          </div>
          <div className="border border-royal-line px-4 py-3">
            <p className={labelCls}>Cash expenses</p>
            <p className="mt-1 text-lg font-bold text-red-300" data-testid="drawer-expenses">
              −{formatNaira(s?.cashExpensesKobo ?? 0)}
            </p>
          </div>
          <div className="border border-royal-accent/50 px-4 py-3">
            <p className={labelCls}>
              {isToday ? "Expected in drawer" : "Net cash movement"}
            </p>
            <p className="mt-1 text-lg font-bold text-royal-accent" data-testid="drawer-expected">
              {formatNaira(s?.expectedKobo ?? 0)}
            </p>
          </div>
        </div>
      )}

      {canManage && isToday && (
      <form onSubmit={handleCount} className="mt-6 grid gap-6 border-t border-royal-line pt-6 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div>
          <label className={labelCls}>Counted cash (₦) *</label>
          <input
            className={inputCls}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="Physical cash in the drawer"
            inputMode="decimal"
            required
            data-testid="count-input"
          />
        </div>
        <div>
          <label className={labelCls}>Note</label>
          <input
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional — e.g. mid-shift handover"
            maxLength={255}
          />
        </div>
        <button
          type="submit"
          disabled={countMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-opacity disabled:opacity-50"
          data-testid="count-submit"
        >
          {countMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
          Count drawer
        </button>
      </form>
      )}
      {canManage && !isToday && (
        <p className="mt-6 border-t border-royal-line pt-4 text-xs text-royal-dim">
          Switch back to Today to count the drawer — a count always compares
          against today's live takings.
        </p>
      )}

      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-red-300">
          <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} /> {error}
        </p>
      )}
      {result && (
        <div
          className={`mt-4 flex items-center gap-2 border px-4 py-3 text-sm ${
            result.diffKobo === 0
              ? "border-royal-accent/40 text-royal-accent"
              : "border-red-400/40 text-red-300"
          }`}
          data-testid="count-result"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
          Counted {formatNaira(result.countedKobo)} against an expected{" "}
          {formatNaira(result.expectedKobo)} —{" "}
          {result.diffKobo === 0
            ? "perfectly balanced."
            : result.diffKobo > 0
              ? `${formatNaira(result.diffKobo)} over.`
              : `${formatNaira(-result.diffKobo)} short.`}
        </div>
      )}

      {canView && (
        <div className="mt-6 border-t border-royal-line pt-6">
          <div className="flex items-center justify-between gap-4">
            <p className={labelCls}>Counts · {label}</p>
            {counts.data && counts.data.total > 0 && (
              <p className="text-xs text-royal-dim" data-testid="counts-total">
                {counts.data.total} count{counts.data.total === 1 ? "" : "s"}
              </p>
            )}
          </div>
          {counts.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-royal-dim">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
            </div>
          ) : (counts.data?.counts ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-royal-dim">No drawer counts recorded in this period.</p>
          ) : (
            <div className="mt-3 divide-y divide-royal-line border border-royal-line">
              {(counts.data?.counts ?? []).map((c) => (
                <div
                  key={c.countId}
                  className="flex items-center gap-4 px-5 py-3"
                  data-testid={`count-row-${c.countId}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-royal-cream">
                      {new Date(c.countedAt).toLocaleString()} · {c.staffName ?? "—"}
                    </p>
                    {c.note && <p className="mt-0.5 truncate text-xs text-royal-dim">{c.note}</p>}
                  </div>
                  <p className="text-xs text-royal-dim">
                    expected {formatNaira(c.expectedKobo)}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      c.diffKobo === 0
                        ? "text-royal-accent"
                        : c.diffKobo > 0
                          ? "text-royal-cream"
                          : "text-red-300"
                    }`}
                  >
                    {c.diffKobo === 0
                      ? "balanced"
                      : `${c.diffKobo > 0 ? "+" : "−"}${formatNaira(Math.abs(c.diffKobo))}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const EXPENSE_PAGE_SIZE = 25;

function ExpensesSection({ canManage }: { canManage: boolean }) {
  const utils = trpc.useUtils();

  // --- filters -------------------------------------------------------------
  const [preset, setPreset] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box so we don't hit the DB on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  // Any filter change starts again from page 1.
  useEffect(() => {
    setPage(1);
  }, [q, fCategory, fMethod, fStatus, preset, customFrom, customTo]);

  const range = presetToRange(preset, customFrom, customTo);
  const queryInput = {
    ...(q ? { q } : {}),
    ...(fCategory ? { category: fCategory as (typeof EXPENSE_CATEGORIES)[number] } : {}),
    ...(fMethod ? { method: fMethod as "cash" | "bank_pos" | "transfer" } : {}),
    ...(fStatus ? { status: fStatus as "pending" | "approved" | "rejected" | "voided" } : {}),
    ...range,
    page,
    pageSize: EXPENSE_PAGE_SIZE,
  };
  const list = trpc.money.expenses.list.useQuery(queryInput);

  const filtersActive = Boolean(q || fCategory || fMethod || fStatus || range.from || range.to);

  function clearFilters() {
    setSearch("");
    setQ("");
    setFCategory("");
    setFMethod("");
    setFStatus("");
    setPreset("all");
    setCustomFrom("");
    setCustomTo("");
  }

  function filterDescription(): string {
    const parts: string[] = [];
    if (q) parts.push(`matching "${q}"`);
    if (fCategory) parts.push(fCategory);
    if (fMethod) parts.push(fMethod.replace("_", " "));
    if (fStatus) parts.push(`status: ${fStatus}`);
    parts.push(rangeLabel(preset, range.from, range.to));
    return parts.join(" · ");
  }

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>("supplies");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [note, setNote] = useState("");
  const [expenseAt, setExpenseAt] = useState("");
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cancel-then-invalidate. A plain invalidate() only *joins* an in-flight
  // first fetch instead of starting a fresh one — react-query cancels an
  // in-flight fetch on invalidate only when the query already has data, which
  // is never true while the page's mount batch is still running (remote DB +
  // slow insights query stretch that window to seconds). The mutation then
  // "succeeds" but the list keeps showing mount-time data. Cancelling first
  // drops fetchStatus back to idle so the invalidate starts a genuinely fresh
  // fetch. Per-query cancels don't abort the shared batch HTTP request (tRPC
  // aborts it only once every op in the batch is aborted), so the other
  // in-flight queries are unaffected.
  async function refresh() {
    await Promise.all([
      utils.money.expenses.list.cancel(),
      utils.money.drawer.summary.cancel(),
    ]);
    utils.money.expenses.list.invalidate();
    utils.money.drawer.summary.invalidate();
  }

  const createMutation = trpc.money.expenses.create.useMutation({
    onSuccess: (r) => {
      refresh();
      setNotice(
        r.status === "pending"
          ? "Expense recorded — waiting for approval before it counts."
          : "Expense recorded.",
      );
      setError(null);
      setShowForm(false);
      setAmount("");
      setNote("");
      setExpenseAt("");
    },
    onError: (err) => setError(err.message),
  });
  const voidMutation = trpc.money.expenses.void.useMutation({
    onSuccess: () => {
      refresh();
      setNotice("Expense voided — it no longer counts against the drawer.");
      setVoidingId(null);
      setVoidReason("");
    },
    onError: (err) => setError(err.message),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount in naira.");
      return;
    }
    if (note.trim().length < 3) {
      setError("Add a short note (at least 3 characters).");
      return;
    }
    createMutation.mutate({
      category: category as (typeof EXPENSE_CATEGORIES)[number],
      amount: value,
      note: note.trim(),
      method: method as "cash" | "bank_pos" | "transfer",
      ...(expenseAt ? { expenseAt: new Date(expenseAt) } : {}),
    });
  }

  function handlePrint() {
    if (!list.data) return;
    printExpenses(list.data.expenses, {
      filterLabel: filterDescription(),
      approvedTotalKobo: list.data.approvedTotalKobo,
      total: list.data.total,
    });
  }

  const expenses = list.data?.expenses ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / EXPENSE_PAGE_SIZE));

  return (
    <section className="border border-royal-line bg-royal-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          <Receipt className="h-4 w-4" strokeWidth={2} />
          Expenses · all staff
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!list.data || expenses.length === 0}
            className="flex items-center gap-2 rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-50"
            data-testid="expense-print"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={2} />
            Print
          </button>
          {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
            data-testid="new-expense"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New expense
          </button>
          )}
        </div>
      </div>

      {/* --- filter toolbar --- */}
      <div className="mt-5 space-y-3 border border-royal-line bg-royal-bg p-4" data-testid="expense-filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-56 flex-1 items-center gap-2 border-b border-royal-line px-1 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-royal-dim" strokeWidth={2} />
            <input
              className="w-full bg-transparent text-sm text-royal-cream placeholder:text-royal-dim/50 focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search note or category…"
              data-testid="expense-search"
            />
          </div>
          <RangeChips
            preset={preset}
            onPreset={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
            allowAll
            testidBase="expense"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="cursor-pointer border-b border-royal-line bg-transparent px-1 py-1.5 text-xs text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none"
            value={fCategory}
            onChange={(e) => setFCategory(e.target.value)}
            data-testid="expense-filter-category"
          >
            <option value="" className="bg-royal-bg">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-royal-bg">
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="cursor-pointer border-b border-royal-line bg-transparent px-1 py-1.5 text-xs text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none"
            value={fMethod}
            onChange={(e) => setFMethod(e.target.value)}
            data-testid="expense-filter-method"
          >
            <option value="" className="bg-royal-bg">All methods</option>
            <option value="cash" className="bg-royal-bg">Cash (drawer)</option>
            <option value="bank_pos" className="bg-royal-bg">Bank POS</option>
            <option value="transfer" className="bg-royal-bg">Transfer</option>
          </select>
          <select
            className="cursor-pointer border-b border-royal-line bg-transparent px-1 py-1.5 text-xs text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none"
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            data-testid="expense-filter-status"
          >
            <option value="" className="bg-royal-bg">All statuses</option>
            <option value="approved" className="bg-royal-bg">Approved</option>
            <option value="pending" className="bg-royal-bg">Pending approval</option>
            <option value="rejected" className="bg-royal-bg">Rejected</option>
            <option value="voided" className="bg-royal-bg">Voided</option>
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-full border border-royal-line px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent"
              data-testid="expense-filter-clear"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2} />
              Clear
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mt-4 flex items-center gap-2 border border-royal-line bg-royal-bg px-4 py-3 text-sm text-royal-cream">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-royal-accent" strokeWidth={2} />
          {notice}
        </div>
      )}
      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-red-300">
          <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} /> {error}
        </p>
      )}

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="mt-6 border border-royal-line bg-royal-bg p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Category *</label>
              <select
                className={`${inputCls} cursor-pointer`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="expense-category"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-royal-bg">
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (₦) *</label>
              <input
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 15000"
                inputMode="decimal"
                required
                data-testid="expense-amount"
              />
            </div>
            <div>
              <label className={labelCls}>Paid via *</label>
              <select
                className={`${inputCls} cursor-pointer`}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                data-testid="expense-method"
              >
                <option value="cash" className="bg-royal-bg">Cash (drawer)</option>
                <option value="bank_pos" className="bg-royal-bg">Bank POS</option>
                <option value="transfer" className="bg-royal-bg">Transfer</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Note *</label>
              <input
                className={inputCls}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What was it for?"
                required
                minLength={3}
                maxLength={500}
                data-testid="expense-note"
              />
            </div>
            {canManage && (
              <div>
                <label className={labelCls}>Backdate</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={expenseAt}
                  onChange={(e) => setExpenseAt(e.target.value)}
                  data-testid="expense-backdate"
                />
              </div>
            )}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-opacity disabled:opacity-50"
              data-testid="expense-submit"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
              Record expense
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-royal-line px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {list.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
        </div>
      ) : expenses.length === 0 ? (
        <p className="mt-4 text-sm text-royal-dim">
          {filtersActive
            ? "No expenses match these filters — try clearing them."
            : "No expenses recorded yet. Cash expenses reduce the expected drawer balance."}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-royal-line border border-royal-line">
          {expenses.map((e) => (
            <div key={e.expenseId} className="px-5 py-4" data-testid={`expense-row-${e.expenseId}`}>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${e.voidedAt ? "text-royal-dim line-through" : "text-royal-cream"}`}>
                    {e.note}
                    <span className="ml-3 border border-royal-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      {e.category}
                    </span>
                    <span className="ml-2 border border-royal-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      {e.method.replace("_", " ")}
                    </span>
                    {e.status === "pending" && (
                      <span
                        className="ml-2 border border-amber-400/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-amber-300"
                        data-testid={`expense-pending-${e.expenseId}`}
                      >
                        Pending approval
                      </span>
                    )}
                    {e.status === "rejected" && (
                      <span
                        className="ml-2 border border-red-400/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-red-300"
                        data-testid={`expense-rejected-${e.expenseId}`}
                      >
                        Rejected
                      </span>
                    )}
                    {e.voidedAt && (
                      <span className="ml-2 border border-red-400/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-red-300">
                        voided
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs text-royal-dim">
                    {new Date(e.expenseAt).toLocaleString()} · by {e.staffName ?? "—"}
                    {e.status === "rejected" &&
                      ` · rejected by ${e.decidedByName ?? "—"}: ${e.rejectReason ?? "no reason given"}`}
                    {e.voidedAt && ` · voided by ${e.voidedByName ?? "—"}: ${e.voidReason}`}
                  </p>
                </div>
                <p className={`text-sm font-bold ${e.voidedAt || e.status !== "approved" ? "text-royal-dim" : "text-royal-accent"}`}>
                  {formatNaira(e.amountKobo)}
                </p>
                {canManage && !e.voidedAt && e.status === "approved" && (
                  <button
                    type="button"
                    onClick={() => {
                      setVoidingId(voidingId === e.expenseId ? null : e.expenseId);
                      setVoidReason("");
                    }}
                    className="rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-red-400 hover:text-red-300"
                    data-testid={`void-expense-${e.expenseId}`}
                  >
                    Void
                  </button>
                )}
              </div>
              {voidingId === e.expenseId && (
                <form
                  className="mt-3 flex items-center gap-3"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    if (voidReason.trim().length >= 3) {
                      voidMutation.mutate({ expenseId: e.expenseId, reason: voidReason.trim() });
                    }
                  }}
                >
                  <input
                    className={`${inputCls} mt-0 flex-1`}
                    value={voidReason}
                    onChange={(ev2) => setVoidReason(ev2.target.value)}
                    placeholder="Why is this expense being voided? (min 3 chars)"
                    minLength={3}
                    required
                    data-testid="void-reason"
                  />
                  <button
                    type="submit"
                    disabled={voidMutation.isPending}
                    className="flex items-center gap-2 rounded-full border border-red-400 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300 transition-opacity disabled:opacity-50"
                    data-testid="void-confirm"
                  >
                    {voidMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
                    Confirm void
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- footer: totals + pagination --- */}
      {!list.isLoading && expenses.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-royal-dim">
          <p data-testid="expenses-total">
            {total} expense{total === 1 ? "" : "s"}
            {filtersActive ? " matching" : ""} · approved total{" "}
            <span className="font-semibold text-royal-cream">
              {formatNaira(list.data?.approvedTotalKobo ?? 0)}
            </span>
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full border border-royal-line px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-40"
                data-testid="expenses-prev"
              >
                Newer
              </button>
              <span data-testid="expenses-page">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-full border border-royal-line px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-40"
                data-testid="expenses-next"
              >
                Older
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
function ExpenseApprovalsSection() {
  const utils = trpc.useUtils();
  const queue = trpc.money.expenses.pendingQueue.useQuery();

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cancel-then-invalidate — see ExpensesSection.refresh for why a plain
  // invalidate can silently join the page's in-flight mount batch instead of
  // starting a fresh fetch. Approving/rejecting changes the queue, the
  // expense list and the drawer summary all at once.
  async function refresh() {
    await Promise.all([
      utils.money.expenses.pendingQueue.cancel(),
      utils.money.expenses.list.cancel(),
      utils.money.drawer.summary.cancel(),
    ]);
    utils.money.expenses.pendingQueue.invalidate();
    utils.money.expenses.list.invalidate();
    utils.money.drawer.summary.invalidate();
  }

  const approveMutation = trpc.money.expenses.approve.useMutation({
    onSuccess: () => {
      refresh();
      setNotice("Expense approved — it now counts against the drawer and reports.");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });
  const rejectMutation = trpc.money.expenses.reject.useMutation({
    onSuccess: () => {
      refresh();
      setNotice("Expense rejected — it will never count.");
      setRejectingId(null);
      setRejectReason("");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const pending = queue.data?.pending ?? [];

  return (
    <section className="border border-royal-line bg-royal-panel p-6" data-testid="approvals-section">
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          Expense approvals
        </p>
        {pending.length > 0 && (
          <span
            className="shrink-0 border border-amber-400/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300"
            data-testid="approvals-count"
          >
            {pending.length} waiting
          </span>
        )}
      </div>
      <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
        Expenses waiting for sign-off. Approved expenses count against the
        drawer and reports; rejected ones never do.
      </p>

      {notice && (
        <div className="mt-4 flex items-center gap-2 border border-royal-line bg-royal-bg px-4 py-3 text-sm text-royal-cream">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-royal-accent" strokeWidth={2} />
          {notice}
        </div>
      )}
      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-red-300" data-testid="approvals-error">
          <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} /> {error}
        </p>
      )}

      {queue.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
        </div>
      ) : pending.length === 0 ? (
        <p className="mt-4 text-sm text-royal-dim" data-testid="approvals-empty">
          Nothing waiting for approval.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-royal-line border border-royal-line">
          {pending.map((e) => (
            <div key={e.expenseId} className="px-5 py-4" data-testid={`approval-row-${e.expenseId}`}>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-royal-cream">
                    {e.note}
                    <span className="ml-3 border border-royal-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      {e.category}
                    </span>
                    <span className="ml-2 border border-royal-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      {e.method.replace("_", " ")}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-xs text-royal-dim">
                    {new Date(e.expenseAt).toLocaleString()} · logged by {e.staffName ?? "—"}
                  </p>
                </div>
                <p className="text-sm font-bold text-royal-accent">{formatNaira(e.amountKobo)}</p>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate({ expenseId: e.expenseId })}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="rounded-full border border-royal-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:opacity-50"
                  data-testid={`approve-expense-${e.expenseId}`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(rejectingId === e.expenseId ? null : e.expenseId);
                    setRejectReason("");
                  }}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-red-400 hover:text-red-300 disabled:opacity-50"
                  data-testid={`reject-expense-${e.expenseId}`}
                >
                  Reject
                </button>
              </div>
              {rejectingId === e.expenseId && (
                <form
                  className="mt-3 flex items-center gap-3"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    if (rejectReason.trim().length >= 3) {
                      rejectMutation.mutate({ expenseId: e.expenseId, reason: rejectReason.trim() });
                    }
                  }}
                >
                  <input
                    className={`${inputCls} mt-0 flex-1`}
                    value={rejectReason}
                    onChange={(ev2) => setRejectReason(ev2.target.value)}
                    placeholder="Why is this expense rejected? (min 3 chars)"
                    minLength={3}
                    required
                    data-testid="reject-reason"
                  />
                  <button
                    type="submit"
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-2 rounded-full border border-red-400 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300 transition-opacity disabled:opacity-50"
                    data-testid="reject-confirm"
                  >
                    {rejectMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
                    Confirm reject
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bank POS terminals (manager only)
// ---------------------------------------------------------------------------

type TerminalForm = {
  name: string;
  provider: string;
  terminalCode: string;
  notes: string;
};
const EMPTY_FORM: TerminalForm = { name: "", provider: "", terminalCode: "", notes: "" };

function TerminalsSection({ canManage }: { canManage: boolean }) {
  const utils = trpc.useUtils();

  const list = trpc.terminals.list.useQuery();

  // Date range for the takings cards (default: today, like the bank's own
  // end-of-day report — but staff can now ask "what should have landed on the
  // machine between these two dates?").
  const [preset, setPreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const range = presetToRange(preset, customFrom, customTo);
  const stats = trpc.terminals.todayStats.useQuery(range, {
    refetchInterval: 60_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TerminalForm>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    // Cancel-then-invalidate — see the ExpensesSection refresh() comment.
    await Promise.all([
      utils.terminals.list.cancel(),
      utils.terminals.todayStats.cancel(),
    ]);
    utils.terminals.list.invalidate();
    utils.terminals.todayStats.invalidate();
  }

  const createMutation = trpc.terminals.create.useMutation({
    onSuccess: () => {
      refresh();
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice("Terminal registered. Cashiers can now pick it at checkout.");
    },
    onError: (err) => setNotice(err.message),
  });
  const updateMutation = trpc.terminals.update.useMutation({
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
    onError: (err) => setNotice(err.message),
  });
  const toggleMutation = trpc.terminals.update.useMutation({
    onSuccess: () => refresh(),
    onError: (err) => setNotice(err.message),
  });

  const busy =
    createMutation.isPending || updateMutation.isPending || toggleMutation.isPending;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNotice(null);
    setShowForm(true);
  }

  function openEdit(t: {
    id: number;
    name: string;
    provider: string | null;
    terminalCode: string | null;
    notes: string | null;
  }) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      provider: t.provider ?? "",
      terminalCode: t.terminalCode ?? "",
      notes: t.notes ?? "",
    });
    setNotice(null);
    setShowForm(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    const payload = {
      name: form.name,
      provider: form.provider || undefined,
      terminalCode: form.terminalCode || undefined,
      notes: form.notes || undefined,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const terminals = list.data ?? [];
  const rangeTotalKobo =
    (stats.data?.terminals ?? []).reduce((sum, t) => sum + t.totalKobo, 0) +
    (stats.data?.unassigned.totalKobo ?? 0);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Bank POS terminals
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Register every card machine on the counter. Cashiers pick the
            terminal used on each card payment, so end-of-day settlement
            matches each machine's own report.
          </p>
        </div>
        {canManage && (
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
          className="flex shrink-0 items-center gap-2 rounded-full border border-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New terminal
        </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center gap-2 border border-royal-line bg-royal-panel px-4 py-3 text-sm text-royal-cream">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-royal-accent" strokeWidth={2} />
          {notice}
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="border border-royal-line bg-royal-panel p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            {editingId !== null ? "Edit terminal" : "Register a terminal"}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Terminal name *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Counter POS 1"
                required
                minLength={2}
                maxLength={64}
              />
            </div>
            <div>
              <label className={labelCls}>Provider / bank</label>
              <input
                className={inputCls}
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                placeholder="Moniepoint, OPay, GTB…"
                maxLength={64}
              />
            </div>
            <div>
              <label className={labelCls}>Terminal code / serial</label>
              <input
                className={inputCls}
                value={form.terminalCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, terminalCode: e.target.value }))
                }
                placeholder="Printed on the machine or its receipt"
                maxLength={64}
              />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                className={inputCls}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional — e.g. lives at the bar counter"
                maxLength={255}
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-opacity disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
              {editingId !== null ? "Save changes" : "Register terminal"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="rounded-full border border-royal-line px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Card takings by terminal over the selected range */}
      <section className="border border-royal-line bg-royal-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            <Banknote className="h-4 w-4" strokeWidth={2} />
            Card takings by terminal · {rangeLabel(preset, customFrom, customTo)}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="terminals-print"
              disabled={stats.isLoading}
              onClick={() =>
                printTerminalTakings(
                  stats.data?.terminals ?? [],
                  stats.data?.unassigned ?? { payments: 0, totalKobo: 0 },
                  rangeLabel(preset, customFrom, customTo),
                )
              }
              className="flex items-center gap-2 rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={2} />
              Print
            </button>
            <p className="text-sm font-semibold text-royal-cream" data-testid="terminals-total">
              {formatNaira(rangeTotalKobo)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <RangeChips
            preset={preset}
            onPreset={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
            testidBase="term"
          />
        </div>
        {stats.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-royal-dim">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(stats.data?.terminals ?? []).map((t) => (
              <div
                key={t.id}
                className="border border-royal-line px-4 py-3"
                data-testid={`term-stat-${t.id}`}
              >
                <p className="truncate text-sm font-semibold text-royal-cream">
                  {t.name}
                  {!t.active && (
                    <span className="ml-2 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      disabled
                    </span>
                  )}
                </p>
                <p className="mt-1 text-lg font-bold text-royal-accent">
                  {formatNaira(t.totalKobo)}
                </p>
                <p className="text-[11px] text-royal-dim">
                  {t.payments} payment{t.payments === 1 ? "" : "s"} in range
                </p>
              </div>
            ))}
            <div className="border border-dashed border-royal-line px-4 py-3">
              <p className="text-sm font-semibold text-royal-dim">Not assigned to a terminal</p>
              <p className="mt-1 text-lg font-bold text-royal-cream">
                {formatNaira(stats.data?.unassigned.totalKobo ?? 0)}
              </p>
              <p className="text-[11px] text-royal-dim">
                {stats.data?.unassigned.payments ?? 0} payment
                {(stats.data?.unassigned.payments ?? 0) === 1 ? "" : "s"} without a terminal pick
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Registry list */}
      <section>
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          <Wallet className="h-4 w-4" strokeWidth={2} />
          Registered terminals
        </p>
        {list.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-royal-dim">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
          </div>
        ) : terminals.length === 0 ? (
          <div className="mt-4 border border-dashed border-royal-line px-6 py-10 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-royal-dim" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-royal-dim">
              No terminals yet — register your first card machine so cashiers
              can tag card payments to it.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-royal-line border border-royal-line">
            {terminals.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-4 px-5 py-4"
                data-testid={`terminal-row-${t.id}`}
              >
                <CreditCard
                  className={`h-5 w-5 shrink-0 ${t.active ? "text-royal-accent" : "text-royal-dim"}`}
                  strokeWidth={2}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-royal-cream">
                    {t.name}
                    <span
                      className={`ml-3 border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] ${
                        t.active
                          ? "border-royal-accent/40 text-royal-accent"
                          : "border-royal-line text-royal-dim"
                      }`}
                    >
                      {t.active ? "Active" : "Disabled"}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-xs text-royal-dim">
                    {[t.provider, t.terminalCode && `S/N ${t.terminalCode}`, t.notes]
                      .filter(Boolean)
                      .join(" · ") || "No extra details"}
                  </p>
                </div>
                {canManage && (
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-50"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                  Edit
                </button>
                )}
                {canManage && (
                <button
                  type="button"
                  onClick={() =>
                    toggleMutation.mutate({ id: t.id, active: !t.active })
                  }
                  disabled={busy}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors disabled:opacity-50 ${
                    t.active
                      ? "border-royal-line text-royal-dim hover:border-red-400 hover:text-red-300"
                      : "border-royal-line text-royal-dim hover:border-royal-accent hover:text-royal-accent"
                  }`}
                >
                  {t.active ? (
                    <>
                      <PowerOff className="h-3 w-3" strokeWidth={2} />
                      Disable
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3" strokeWidth={2} />
                      Enable
                    </>
                  )}
                </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------


type MoneyTab = "drawer" | "expenses" | "approvals" | "terminals";

const TAB_DEFS: {
  key: MoneyTab;
  label: string;
  icon: typeof Scale;
}[] = [
  { key: "drawer", label: "Cash drawer", icon: Scale },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "approvals", label: "Approvals", icon: ShieldCheck },
  { key: "terminals", label: "POS terminals", icon: CreditCard },
];

export default function MoneyPage() {
  const { has } = usePerms();
  const [searchParams, setSearchParams] = useSearchParams();

  const canDrawer = has("drawer", "view");
  const canExpenses = has("expenses", "view");
  const canApprovals = has("expenseApprovals", "manage");
  const canTerminals = has("terminals", "view");

  const allowed: Record<MoneyTab, boolean> = {
    drawer: canDrawer,
    expenses: canExpenses,
    approvals: canApprovals,
    terminals: canTerminals,
  };
  const visibleTabs = TAB_DEFS.filter((t) => allowed[t.key]);

  const rawTab = searchParams.get("tab") as MoneyTab | null;
  const activeTab: MoneyTab =
    rawTab && allowed[rawTab] ? rawTab : (visibleTabs[0]?.key ?? "drawer");

  function selectTab(key: MoneyTab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  }

  // Pending-approval badge on the Approvals tab so managers spot the queue
  // from any tab.
  const pendingQueue = trpc.money.expenses.pendingQueue.useQuery(undefined, {
    enabled: canApprovals,
    refetchInterval: 30_000,
  });
  const pendingCount = canApprovals ? (pendingQueue.data?.pending.length ?? 0) : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          Money
        </p>
        <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
          Count the cash drawer against takings, record shop expenses, and
          reconcile each card machine. Cash expenses reduce what should be in
          the drawer.
        </p>
      </div>

      {visibleTabs.length > 1 && (
        <div
          className="flex flex-wrap gap-x-6 gap-y-2 border-b border-royal-line"
          role="tablist"
          data-testid="money-tabs"
        >
          {visibleTabs.map(({ key, label, icon: Icon }) => {
            const active = key === activeTab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`money-tab-${key}`}
                onClick={() => selectTab(key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                  active
                    ? "border-royal-accent text-royal-accent"
                    : "border-transparent text-royal-dim hover:border-royal-accent/40 hover:text-royal-cream"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
                {key === "approvals" && pendingCount > 0 && (
                  <span
                    className="rounded-full bg-royal-accent px-2 py-0.5 text-[9px] font-bold text-royal-bg"
                    data-testid="money-tab-approvals-badge"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" data-testid={`money-panel-${activeTab}`}>
        {activeTab === "drawer" && canDrawer && (
          <CashDrawerSection canView={canDrawer} canManage={has("drawer", "manage")} />
        )}
        {activeTab === "expenses" && canExpenses && (
          <ExpensesSection canManage={has("expenses", "manage")} />
        )}
        {activeTab === "approvals" && canApprovals && <ExpenseApprovalsSection />}
        {activeTab === "terminals" && canTerminals && (
          <TerminalsSection canManage={has("terminals", "manage")} />
        )}
      </div>
    </div>
  );
}
