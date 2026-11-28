// Payroll run detail page (v37) — /payroll/:id. Draft runs: per-staff
// bonus/deduction editing, remove, pay-from-account, cancel. Paid runs are
// read-only. Always printable.

import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, Printer, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";
import { usePerms } from "@/lib/perms";
import { printPayrollRun } from "@/lib/printPayroll";
import { periodLabel } from "@/pages/Payroll";

const inputCls =
  "w-full border-b border-royal-line bg-transparent py-1.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

const STATUS_PILL: Record<string, string> = {
  draft: "border-amber-300/40 bg-amber-400/10 text-amber-200",
  paid: "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-rose-300/40 bg-rose-400/10 text-rose-200",
};

export default function PayrollRunPage() {
  const { id } = useParams();
  const runId = Number(id);
  const { has } = usePerms();
  const canManage = has("payroll", "manage");
  const utils = trpc.useUtils();

  const detail = trpc.payroll.detail.useQuery({ runId });
  const accountsQ = trpc.accounts.list.useQuery();

  // Per-row draft edits: itemId -> {bonus, deduction, note} as typed strings
  const [edits, setEdits] = useState<Record<number, { bonus: string; deduction: string; note: string }>>({});
  const [payAccountId, setPayAccountId] = useState<number | "">("");
  const [error, setError] = useState("");

  const refresh = async () => {
    await utils.payroll.detail.cancel();
    await utils.payroll.list.cancel();
    await utils.accounts.list.cancel();
    await Promise.all([
      utils.payroll.detail.invalidate(),
      utils.payroll.list.invalidate(),
      utils.accounts.list.invalidate(),
    ]);
  };

  const updateItem = trpc.payroll.updateItem.useMutation({
    onSuccess: refresh,
    onError: (e) => setError(e.message),
  });
  const removeItem = trpc.payroll.removeItem.useMutation({
    onSuccess: refresh,
    onError: (e) => setError(e.message),
  });
  const pay = trpc.payroll.pay.useMutation({
    onSuccess: refresh,
    onError: (e) => setError(e.message),
  });
  const cancel = trpc.payroll.cancel.useMutation({
    onSuccess: refresh,
    onError: (e) => setError(e.message),
  });

  if (detail.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-royal-accent" />
      </div>
    );
  }
  if (!detail.data) {
    return <p className="p-10 text-center text-royal-dim">Payroll run not found.</p>;
  }

  const { run, items } = detail.data;
  const isDraft = run.status === "draft";
  const accounts = accountsQ.data?.accounts ?? [];
  const baseTotal = items.reduce((s, i) => s + i.baseKobo, 0);
  const bonusTotal = items.reduce((s, i) => s + i.bonusKobo, 0);
  const deductionTotal = items.reduce((s, i) => s + i.deductionKobo, 0);

  const editFor = (itemId: number) =>
    edits[itemId] ?? null;

  const setEdit = (itemId: number, key: "bonus" | "deduction" | "note", v: string, item: (typeof items)[number]) => {
    const cur = editFor(itemId) ?? {
      bonus: String(item.bonusKobo / 100),
      deduction: String(item.deductionKobo / 100),
      note: item.note ?? "",
    };
    setEdits({ ...edits, [itemId]: { ...cur, [key]: v } });
  };

  const saveRow = (item: (typeof items)[number]) => {
    const e = editFor(item.id);
    if (!e) return;
    setError("");
    updateItem.mutate({
      itemId: item.id,
      bonus: Number(e.bonus || 0),
      deduction: Number(e.deduction || 0),
      note: e.note.trim() === "" ? null : e.note.trim(),
    });
    const next = { ...edits };
    delete next[item.id];
    setEdits(next);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/payroll" className="mb-1 flex items-center gap-1 text-xs text-royal-dim hover:text-royal-cream">
            <ArrowLeft className="h-3 w-3" /> All payroll runs
          </Link>
          <h2 className="font-display text-2xl text-royal-cream sm:text-3xl" data-testid="payroll-run-title">
            Payroll — {periodLabel(run.period)}
          </h2>
          <p className="mt-1 text-xs text-royal-dim">
            Prepared by {run.createdByName}
            {run.paidAt ? ` · paid ${new Date(run.paidAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
            {run.accountName ? ` from ${run.accountName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_PILL[run.status]}`}
            data-testid="payroll-run-status"
          >
            {run.status}
          </span>
          <button
            type="button"
            data-testid="payroll-print"
            onClick={() => printPayrollRun({ run, items })}
            className="flex items-center gap-2 border border-royal-line px-3 py-2 text-xs text-royal-cream transition-colors hover:border-royal-accent"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          {isDraft && canManage && (
            <button
              type="button"
              data-testid="payroll-cancel"
              onClick={() => {
                setError("");
                cancel.mutate({ runId });
              }}
              className="border border-rose-300/40 px-3 py-2 text-xs text-rose-200 transition-colors hover:bg-rose-400/10"
            >
              Cancel run
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Staff", String(items.length), "payroll-kpi-staff"],
          ["Base", formatNaira(baseTotal), "payroll-kpi-base"],
          ["Bonuses", formatNaira(bonusTotal), "payroll-kpi-bonus"],
          ["Deductions", formatNaira(deductionTotal), "payroll-kpi-deduction"],
          ["Net total", formatNaira(run.totalKobo), "payroll-kpi-total"],
        ].map(([label, value, tid]) => (
          <div key={tid} className="border border-royal-line/60 p-3">
            <p className={labelCls}>{label}</p>
            <p className="mt-1 text-lg font-semibold text-royal-cream" data-testid={tid}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p data-testid="payroll-error" className="border border-rose-300/30 bg-rose-400/10 p-3 text-xs text-rose-200">
          {error}
        </p>
      )}

      {/* Items */}
      <div className="overflow-x-auto royal-scroll border border-royal-line/60">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-royal-line/60 text-left text-[10px] uppercase tracking-wider text-royal-dim">
              <th className="p-3">Staff</th>
              <th className="p-3 text-right">Base</th>
              <th className="p-3 text-right">Bonus (₦)</th>
              <th className="p-3 text-right">Deduction (₦)</th>
              <th className="p-3 text-right">Net pay</th>
              <th className="p-3">Note</th>
              {isDraft && canManage && <th className="p-3"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const e = editFor(it.id);
              const editable = isDraft && canManage;
              return (
                <tr key={it.id} className="border-b border-royal-line/40" data-testid={`pr-item-${it.id}`}>
                  <td className="p-3">
                    <p className="text-royal-cream">{it.staffName}</p>
                    <p className="text-xs text-royal-dim">{it.staffCode} · {it.role}</p>
                  </td>
                  <td className="p-3 text-right text-royal-cream">{formatNaira(it.baseKobo)}</td>
                  <td className="p-3 text-right">
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        className={`${inputCls} w-24 text-right`}
                        value={e ? e.bonus : String(it.bonusKobo / 100)}
                        onChange={(ev) => setEdit(it.id, "bonus", ev.target.value, it)}
                        data-testid={`pr-bonus-${it.id}`}
                      />
                    ) : (
                      <span className="text-emerald-200">{it.bonusKobo ? formatNaira(it.bonusKobo) : "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        className={`${inputCls} w-24 text-right`}
                        value={e ? e.deduction : String(it.deductionKobo / 100)}
                        onChange={(ev) => setEdit(it.id, "deduction", ev.target.value, it)}
                        data-testid={`pr-deduction-${it.id}`}
                      />
                    ) : (
                      <span className="text-rose-200">{it.deductionKobo ? formatNaira(it.deductionKobo) : "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-royal-cream" data-testid={`pr-net-${it.id}`}>
                    {formatNaira(it.netKobo)}
                  </td>
                  <td className="p-3">
                    {editable ? (
                      <input
                        className={`${inputCls} w-36`}
                        value={e ? e.note : (it.note ?? "")}
                        onChange={(ev) => setEdit(it.id, "note", ev.target.value, it)}
                        maxLength={255}
                        data-testid={`pr-note-${it.id}`}
                      />
                    ) : (
                      <span className="text-xs text-royal-dim">{it.note ?? "—"}</span>
                    )}
                  </td>
                  {editable && (
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        {e && (
                          <button
                            type="button"
                            onClick={() => saveRow(it)}
                            disabled={updateItem.isPending}
                            data-testid={`pr-save-${it.id}`}
                            className="border border-royal-accent bg-royal-accent/20 px-2 py-1 text-[10px] font-semibold text-royal-cream"
                          >
                            Save
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            removeItem.mutate({ itemId: it.id });
                          }}
                          data-testid={`pr-remove-${it.id}`}
                          className="p-1 text-royal-dim transition-colors hover:text-rose-300"
                          title="Remove from this run"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pay panel */}
      {isDraft && canManage && (
        <section className="border border-royal-line/60 p-4 sm:p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
            Pay this run
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-56 flex-1">
              <span className={labelCls}>From account</span>
              <select
                className={`${inputCls} [color-scheme:dark]`}
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value ? Number(e.target.value) : "")}
                data-testid="pay-account"
              >
                <option value="">Choose account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatNaira(a.balanceKobo)})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!payAccountId || pay.isPending || items.length === 0}
              onClick={() => {
                setError("");
                pay.mutate({ runId, accountId: Number(payAccountId) });
              }}
              data-testid="pay-submit"
              className="border border-emerald-300/40 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
            >
              {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatNaira(run.totalKobo)}`}
            </button>
          </div>
          {payAccountId !== "" && (
            <p className="mt-2 text-[11px] text-royal-dim/80">
              {items.length} salary payments will leave this account — one ledger entry per staff member.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
