// Accounts page (v36) — the general bank: cash on hand, bank account and POS
// settlements with live balances, money in/out, internal transfers and the
// full ledger history with filters, search and printing.

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Landmark,
  Loader2,
  Printer,
  Search,
  Wallet,
  CreditCard,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";
import { usePerms } from "@/lib/perms";
import { printAccountStatement } from "@/lib/printAccounts";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";
const selectCls =
  "border-b border-royal-line bg-transparent px-1 py-1.5 text-xs text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none";
const dateCls = selectCls;

const KIND_LABEL: Record<string, string> = {
  sale_payment: "Sale payment",
  expense: "Expense",
  transfer: "Transfer",
  money_in: "Money in",
  money_out: "Money out",
  adjustment: "Adjustment",
  credit_repayment: "Debt repayment",
  payroll: "Salary payment",
};

const MONEY_IN_CATEGORIES = [
  ["owner_investment", "Owner investment"],
  ["loan_received", "Loan received"],
  ["other_income", "Other income"],
] as const;
const MONEY_OUT_CATEGORIES = [
  ["bank_charges", "Bank charges"],
  ["owner_draw", "Owner draw"],
  ["supplier_payment", "Supplier payment"],
  ["other_payout", "Other payout"],
] as const;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ACCOUNT_ICON = { cash: Wallet, bank: Landmark, pos: CreditCard } as const;

export default function AccountsPage() {
  const { has } = usePerms();
  const canManage = has("accounts", "manage");
  const utils = trpc.useUtils();

  const list = trpc.accounts.list.useQuery();
  const staffNames = trpc.staff.names.useQuery();

  // filters
  const [accountId, setAccountId] = useState<number | undefined>(undefined);
  const [kind, setKind] = useState<string>("");
  const [staffId, setStaffId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [accountId, kind, staffId, from, to, qDebounced]);

  const txQuery = trpc.accounts.transactions.useQuery({
    accountId,
    kind: (kind || undefined) as never,
    staffId: staffId ? Number(staffId) : undefined,
    from: from || undefined,
    to: to || undefined,
    q: qDebounced || undefined,
    page,
    pageSize: 25,
  });

  const [modal, setModal] = useState<"in" | "out" | "transfer" | null>(null);

  const refresh = async () => {
    await utils.accounts.list.cancel();
    await utils.accounts.transactions.cancel();
    await Promise.all([utils.accounts.list.invalidate(), utils.accounts.transactions.invalidate()]);
  };

  const accounts = list.data?.accounts ?? [];
  const totalPages = Math.max(1, Math.ceil((txQuery.data?.total ?? 0) / 25));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-royal-cream sm:text-3xl">Bank &amp; Cash</h2>
          <p className="mt-1 text-xs text-royal-dim">
            Every naira the business holds — balances, money in/out and internal transfers.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="money-in-open"
              onClick={() => setModal("in")}
              className="flex items-center gap-1.5 rounded-full border border-emerald-400/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300 transition-colors hover:bg-emerald-400/10"
            >
              <ArrowDownLeft className="h-3.5 w-3.5" /> Money in
            </button>
            <button
              type="button"
              data-testid="money-out-open"
              onClick={() => setModal("out")}
              className="flex items-center gap-1.5 rounded-full border border-rose-400/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-rose-300 transition-colors hover:bg-rose-400/10"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Money out
            </button>
            <button
              type="button"
              data-testid="transfer-open"
              onClick={() => setModal("transfer")}
              className="flex items-center gap-1.5 rounded-full border border-royal-accent bg-royal-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-bg transition-colors hover:bg-royal-accent/85"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
            </button>
          </div>
        )}
      </div>

      {/* Account cards */}
      {list.isLoading && <p className="py-10 text-center text-sm text-royal-dim">Loading accounts…</p>}
      {list.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {accounts.map((a) => {
            const Icon = ACCOUNT_ICON[a.type as keyof typeof ACCOUNT_ICON] ?? Wallet;
            const selected = accountId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                data-testid={`account-card-${a.code.toLowerCase()}`}
                onClick={() => setAccountId(selected ? undefined : a.id)}
                className={`border p-4 text-left transition-colors ${
                  selected ? "border-royal-accent bg-royal-accent/10" : "border-royal-line bg-royal-panel hover:border-royal-accent/60"
                }`}
              >
                <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
                  {a.name}
                  <Icon className="h-4 w-4 text-royal-accent" strokeWidth={1.75} />
                </p>
                <p className="mt-2 font-display text-2xl text-royal-cream" data-testid={`account-balance-${a.code.toLowerCase()}`}>
                  {formatNaira(a.balanceKobo)}
                </p>
                <p className="mt-1 text-[11px] text-royal-dim">
                  Today <span className="text-emerald-300">+{formatNaira(a.todayInKobo)}</span>
                  {" · "}
                  <span className="text-rose-300">−{formatNaira(a.todayOutKobo)}</span>
                </p>
              </button>
            );
          })}
          {/* Grand total */}
          <div className="border border-royal-accent/50 bg-royal-surface/60 p-4" data-testid="account-card-total">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-accent">
              Total money held
            </p>
            <p className="mt-2 font-display text-2xl text-royal-cream" data-testid="account-balance-total">
              {formatNaira(list.data.totalBalanceKobo)}
            </p>
            <p className="mt-1 text-[11px] text-royal-dim">
              Today <span className="text-emerald-300">+{formatNaira(list.data.totalTodayInKobo)}</span>
              {" · "}
              <span className="text-rose-300">−{formatNaira(list.data.totalTodayOutKobo)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Filters + history */}
      <section className="border border-royal-line bg-royal-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-royal-cream">
            Transaction history
          </h3>
          <button
            type="button"
            data-testid="accounts-print"
            onClick={() =>
              printAccountStatement({
                accounts,
                rows: txQuery.data?.rows ?? [],
                totalInKobo: txQuery.data?.totalInKobo ?? 0,
                totalOutKobo: txQuery.data?.totalOutKobo ?? 0,
                filterLabel: filterLabel(accounts, accountId, kind, staffId, staffNames.data, from, to, qDebounced),
              })
            }
            className="flex items-center gap-1.5 rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="block">
            <span className={labelCls}>Account</span>
            <select
              className={selectCls}
              value={accountId ?? ""}
              onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}
              data-testid="accounts-filter-account"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Type</span>
            <select
              className={selectCls}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              data-testid="accounts-filter-kind"
            >
              <option value="">All types</option>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Staff</span>
            <select
              className={selectCls}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              data-testid="accounts-filter-staff"
            >
              <option value="">Everyone</option>
              {(staffNames.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>From</span>
            <input type="date" className={dateCls} value={from} max={todayIso()} onChange={(e) => setFrom(e.target.value)} data-testid="accounts-from" />
          </label>
          <label className="block">
            <span className={labelCls}>To</span>
            <input type="date" className={dateCls} value={to} max={todayIso()} onChange={(e) => setTo(e.target.value)} data-testid="accounts-to" />
          </label>
          <label className="block min-w-0 flex-1">
            <span className={labelCls}>Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-royal-dim/60" />
              <input
                className={`${inputCls} pl-5`}
                placeholder="Receipt no, note, transfer id…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="accounts-search"
              />
            </span>
          </label>
        </div>

        {/* Totals for the current filter */}
        {txQuery.data && (
          <p className="mt-4 text-xs text-royal-dim" data-testid="accounts-totals">
            {txQuery.data.total} transactions ·{" "}
            <span className="text-emerald-300">in {formatNaira(txQuery.data.totalInKobo)}</span>
            {" · "}
            <span className="text-rose-300">out {formatNaira(txQuery.data.totalOutKobo)}</span>
            {" · net "}
            <span className="font-semibold text-royal-cream">
              {formatNaira(txQuery.data.totalInKobo - txQuery.data.totalOutKobo)}
            </span>
          </p>
        )}

        {/* Table */}
        <div className="royal-scroll mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-royal-line text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim">
                <th className="py-2 pr-3">Date</th>
                <th className="pr-3">Account</th>
                <th className="pr-3">Type</th>
                <th className="pr-3 text-right">In</th>
                <th className="pr-3 text-right">Out</th>
                <th className="pr-3">Details</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {(txQuery.data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-b border-royal-line/50" data-testid={`account-tx-${r.id}`}>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-royal-dim">
                    {new Date(r.createdAt).toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="pr-3 text-xs text-royal-cream">{r.accountName}</td>
                  <td className="pr-3">
                    <span className="border border-royal-line px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-royal-dim">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                  </td>
                  <td className="pr-3 text-right font-semibold text-emerald-300">
                    {r.direction === "in" ? `+${formatNaira(r.amountKobo)}` : ""}
                  </td>
                  <td className="pr-3 text-right font-semibold text-rose-300">
                    {r.direction === "out" ? `−${formatNaira(r.amountKobo)}` : ""}
                  </td>
                  <td className="max-w-[260px] truncate pr-3 text-xs text-royal-dim" title={r.note ?? ""}>
                    {r.refId ? `${r.refId} · ` : ""}{r.note ?? ""}
                  </td>
                  <td className="text-xs text-royal-dim">{r.staffName ?? "—"}</td>
                </tr>
              ))}
              {txQuery.data && txQuery.data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-royal-dim">
                    No transactions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-royal-dim">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border border-royal-line px-4 py-1.5 disabled:opacity-40"
              data-testid="accounts-prev"
            >
              ← Newer
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-royal-line px-4 py-1.5 disabled:opacity-40"
              data-testid="accounts-next"
            >
              Older →
            </button>
          </div>
        )}
      </section>

      {modal && (
        <MoneyModal
          kind={modal}
          accounts={accounts}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function filterLabel(
  accounts: Array<{ id: number; name: string }>,
  accountId: number | undefined,
  kind: string,
  staffId: string,
  staff: Array<{ id: number; name: string }> | undefined,
  from: string,
  to: string,
  q: string,
): string {
  const parts: string[] = [];
  const acct = accounts.find((a) => a.id === accountId);
  if (acct) parts.push(acct.name);
  if (kind) parts.push(KIND_LABEL[kind] ?? kind);
  const st = staff?.find((s) => s.id === Number(staffId));
  if (st) parts.push(`by ${st.name}`);
  if (from || to) parts.push(`${from || "…"} → ${to || "…"}`);
  if (q) parts.push(`“${q}”`);
  return parts.length ? parts.join(" · ") : "All transactions";
}

// ---------------------------------------------------------------------------
// Money in / out / transfer modal
// ---------------------------------------------------------------------------

function MoneyModal({
  kind,
  accounts,
  onClose,
  onDone,
}: {
  kind: "in" | "out" | "transfer";
  accounts: Array<{ id: number; code: string; name: string; balanceKobo: number }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(
    kind === "in" ? MONEY_IN_CATEGORIES[0][0] : MONEY_OUT_CATEGORIES[0][0],
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inMut = trpc.accounts.moneyIn.useMutation({ onError: (e) => setError(e.message) });
  const outMut = trpc.accounts.moneyOut.useMutation({ onError: (e) => setError(e.message) });
  const trMut = trpc.accounts.transfer.useMutation({ onError: (e) => setError(e.message) });
  const pending = inMut.isPending || outMut.isPending || trMut.isPending;

  const title = kind === "in" ? "Money in" : kind === "out" ? "Money out" : "Internal transfer";
  const categories = kind === "in" ? MONEY_IN_CATEGORIES : MONEY_OUT_CATEGORIES;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter an amount above zero.");
      return;
    }
    try {
      if (kind === "in") await inMut.mutateAsync({ accountId, amount: amt, category: category as never, note });
      else if (kind === "out") await outMut.mutateAsync({ accountId, amount: amt, category: category as never, note });
      else await trMut.mutateAsync({ fromAccountId: accountId, toAccountId, amount: amt, note: note || undefined });
      await onDone();
    } catch {
      /* onError shows the message */
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md border border-royal-line bg-royal-bg p-6"
        data-testid={`${kind}-modal`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">{title}</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={labelCls}>{kind === "transfer" ? "From account" : "Account"}</span>
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} data-testid="modal-account">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatNaira(a.balanceKobo)})</option>
              ))}
            </select>
          </label>
          {kind === "transfer" && (
            <label className="block">
              <span className={labelCls}>To account</span>
              <select className={inputCls} value={toAccountId} onChange={(e) => setToAccountId(Number(e.target.value))} data-testid="modal-to-account">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          )}
          {kind !== "transfer" && (
            <label className="block">
              <span className={labelCls}>Category</span>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} data-testid="modal-category">
                {categories.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className={labelCls}>Amount (₦)</span>
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="modal-amount"
            />
          </label>
          <label className="block">
            <span className={labelCls}>{kind === "transfer" ? "Note (optional)" : "Note"}</span>
            <input
              className={inputCls}
              placeholder={kind === "transfer" ? "e.g. Bank deposit from till" : "What is this for?"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="modal-note"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-rose-400" data-testid="modal-error">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full border border-royal-accent bg-royal-accent px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-bg transition-colors hover:bg-royal-accent/85 disabled:opacity-40"
            data-testid="modal-submit"
          >
            {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : title}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-royal-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-dim"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
