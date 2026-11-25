import { useState, type FormEvent } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

type TerminalForm = {
  name: string;
  provider: string;
  terminalCode: string;
  notes: string;
};
const EMPTY_FORM: TerminalForm = { name: "", provider: "", terminalCode: "", notes: "" };

export default function MoneyPage() {
  const utils = trpc.useUtils();

  const list = trpc.terminals.list.useQuery();
  const stats = trpc.terminals.todayStats.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TerminalForm>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
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
  const todayTotalKobo =
    (stats.data?.terminals ?? []).reduce((sum, t) => sum + t.totalKobo, 0) +
    (stats.data?.unassigned.totalKobo ?? 0);

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Money · Bank POS terminals
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Register every card machine on the counter. Cashiers pick the
            terminal used on each card payment, so end-of-day settlement
            matches each machine's own report. Cash drawer and expenses join
            this page in Phase 3.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
          className="flex shrink-0 items-center gap-2 rounded-full border border-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New terminal
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 border border-royal-line bg-royal-panel px-4 py-3 text-sm text-royal-cream">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-royal-accent" strokeWidth={2} />
          {notice}
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-royal-line bg-royal-panel p-6"
        >
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

      {/* Today by terminal */}
      <section className="border border-royal-line bg-royal-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            <Banknote className="h-4 w-4" strokeWidth={2} />
            Today's card takings by terminal
          </p>
          <p className="text-sm font-semibold text-royal-cream">
            {formatNaira(todayTotalKobo)}
          </p>
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
                data-testid={`today-terminal-${t.id}`}
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
                  {t.payments} payment{t.payments === 1 ? "" : "s"} today
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
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-50"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                  Edit
                </button>
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
