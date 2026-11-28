// Payroll page (v37) — monthly salary runs. Generate a draft for a month from
// staff salary structures, adjust bonuses/deductions per staff on the run page,
// then pay the run from an account — every salary leaves a ledger trace.

import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Banknote, ChevronRight, Loader2, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";
import { usePerms } from "@/lib/perms";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";
const selectCls =
  "border-b border-royal-line bg-transparent px-1 py-1.5 text-xs text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none";

const STATUS_PILL: Record<string, string> = {
  draft: "border-amber-300/40 bg-amber-400/10 text-amber-200",
  paid: "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-rose-300/40 bg-rose-400/10 text-rose-200",
};

export function periodLabel(period: string): string {
  return new Date(`${period}-02T00:00:00`).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function GenerateModal({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState(currentPeriod());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ itemCount: number; skippedCount: number } | null>(null);

  const generate = trpc.payroll.generate.useMutation({
    onSuccess: async (r) => {
      setResult({ itemCount: r.itemCount, skippedCount: r.skippedCount });
      await utils.payroll.list.cancel();
      await utils.payroll.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    generate.mutate({ period, note: note.trim() || undefined });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      data-testid="generate-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-royal-line bg-royal-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl text-royal-cream">New payroll run</h3>
        <p className="mt-1 text-xs text-royal-dim">
          A draft is created for every active staff member with a salary set.
        </p>
        {result ? (
          <div className="mt-5 space-y-4" data-testid="generate-result">
            <p className="border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              Draft created for {result.itemCount} staff
              {result.skippedCount > 0 ? ` — ${result.skippedCount} skipped (no salary set)` : ""}.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-royal-accent bg-royal-accent/20 py-2.5 text-sm font-semibold text-royal-cream"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block">
              <span className={labelCls}>Month</span>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                data-testid="generate-period"
                className={`${inputCls} [color-scheme:dark]`}
                required
              />
            </label>
            <label className="block">
              <span className={labelCls}>Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="generate-note"
                className={inputCls}
                maxLength={255}
                placeholder="e.g. November salaries"
              />
            </label>
            {error && (
              <p data-testid="generate-error" className="border border-rose-300/30 bg-rose-400/10 p-3 text-xs text-rose-200">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-royal-line py-2.5 text-sm text-royal-dim"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generate.isPending}
                data-testid="generate-submit"
                className="flex-1 border border-royal-accent bg-royal-accent/20 py-2.5 text-sm font-semibold text-royal-cream disabled:opacity-50"
              >
                {generate.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create draft"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const { has } = usePerms();
  const canManage = has("payroll", "manage");
  const [status, setStatus] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);

  const list = trpc.payroll.list.useQuery(status ? { status: status as never } : {});
  const salaries = trpc.payroll.staffSalaries.useQuery();

  const runs = list.data?.rows ?? [];
  const staffRows = (salaries.data?.rows ?? []).filter((s) => s.active);
  const withoutSalary = staffRows.filter((s) => (s.salaryKobo ?? 0) <= 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-royal-cream sm:text-3xl">Payroll</h2>
          <p className="mt-1 text-xs text-royal-dim">
            Monthly salary runs — paid from an account, traced in the ledger.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            data-testid="payroll-generate-open"
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 border border-royal-accent bg-royal-accent/20 px-4 py-2 text-sm font-semibold text-royal-cream transition-colors hover:bg-royal-accent/30"
          >
            <Plus className="h-4 w-4" /> New payroll run
          </button>
        )}
      </div>

      {/* Runs */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
            Payroll runs
          </h3>
          <select
            className={selectCls}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            data-testid="payroll-filter-status"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="divide-y divide-royal-line/60 border border-royal-line/60">
          {runs.length === 0 && (
            <p className="p-6 text-sm text-royal-dim" data-testid="payroll-empty">
              No payroll runs yet — create one for this month.
            </p>
          )}
          {runs.map((r) => (
            <Link
              key={r.id}
              to={`/payroll/${r.id}`}
              data-testid={`payroll-run-${r.id}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 transition-colors hover:bg-royal-surface/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Banknote className="h-5 w-5 shrink-0 text-royal-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-royal-cream">{periodLabel(r.period)}</p>
                  <p className="text-xs text-royal-dim">
                    {r.itemCount} staff · by {r.createdByName}
                    {r.accountName ? ` · paid from ${r.accountName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_PILL[r.status]}`}
                  data-testid={`payroll-status-${r.id}`}
                >
                  {r.status}
                </span>
                <span className="text-sm font-semibold text-royal-cream">{formatNaira(r.totalKobo)}</span>
                <ChevronRight className="h-4 w-4 text-royal-dim" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Salary structures */}
      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
          Salary structures
          {withoutSalary.length > 0 ? ` · ${withoutSalary.length} staff without a salary` : ""}
        </h3>
        <div className="overflow-x-auto royal-scroll border border-royal-line/60">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-royal-line/60 text-left text-[10px] uppercase tracking-wider text-royal-dim">
                <th className="p-3">Staff</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">Monthly salary</th>
                <th className="p-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((s) => (
                <tr key={s.id} className="border-b border-royal-line/40" data-testid={`payroll-salary-${s.id}`}>
                  <td className="p-3 text-royal-cream">
                    {s.name} <span className="text-xs text-royal-dim">({s.staffCode})</span>
                  </td>
                  <td className="p-3 text-xs text-royal-dim">{s.role}</td>
                  <td className="p-3 text-right font-semibold">
                    {(s.salaryKobo ?? 0) > 0 ? (
                      <span className="text-royal-cream">{formatNaira(s.salaryKobo ?? 0)}</span>
                    ) : (
                      <span className="text-amber-300">Not set</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-royal-dim">{s.salaryNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-royal-dim/70">
          Salaries are set on the Staff page by an admin — open a staff member and edit the Salary structure section.
        </p>
      </section>

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} />}
    </div>
  );
}
