import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trpc } from "@/providers/trpc";
import { formatNaira, nairaToKobo } from "@contracts/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@contracts/payments";
import { roleAtLeast } from "@contracts/roles";

export interface CompletedSaleResult {
  saleId: number;
  receiptNo: string;
  cashierName: string;
  soldAt: string;
  lines: Array<{
    itemName: string;
    quantity: number;
    modifiers: Array<{ group: string; option: string; priceDeltaKobo: number }>;
    lineTotalKobo: number;
  }>;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  /** Attached customer (regulars / credit tabs). */
  customerName?: string | null;
  /** Amount left on the customer's credit tab by this sale. */
  creditKobo?: number;
  payments: Array<{
    method: PaymentMethod;
    amountKobo: number;
    reference: string | null;
    terminalName?: string | null;
  }>;
  changeKobo: number;
  /** True for a sale saved locally while offline (pending sync). */
  offline?: boolean;
}

/** What the checkout modal hands to its parent on "Complete sale". */
export interface CheckoutSubmitInput {
  items: Array<{ itemId: number; quantity: number; optionIds: number[] }>;
  discount: { type: "percent" | "fixed"; value: number } | null;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
    terminalId?: number;
  }>;
  saleDate?: string;
  /** Attach a customer — required when payments fall short (credit sale). */
  customerId?: number;
}

interface PaymentRow {
  method: PaymentMethod;
  /** naira string as typed */
  amount: string;
  reference: string;
  /** Picked bank POS terminal (bank_pos rows only). */
  terminalId: number | null;
}

const inputCls =
  "w-full border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";

export function CheckoutModal({
  totalKobo,
  lines,
  discount,
  onSubmit,
  onCancel,
  onCompleted,
  onProgress,
  offlineMode = false,
}: {
  totalKobo: number;
  lines: Array<{ itemId: number; quantity: number; optionIds: number[] }>;
  discount: { type: "percent" | "fixed"; value: number } | null;
  /** Parent-owned submit: saves online or queues offline. Must throw with a
   *  user-readable message on failure. */
  onSubmit: (input: CheckoutSubmitInput) => Promise<CompletedSaleResult>;
  onCancel: () => void;
  onCompleted: (sale: CompletedSaleResult) => void;
  /** live payment progress for the customer display */
  onProgress?: (progress: {
    paidKobo: number;
    payments: Array<{ label: string; amountKobo: number }>;
  }) => void;
  /** Offline sales may carry a manual date for any role (within 72h). */
  offlineMode?: boolean;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([
    { method: "cash", amount: (totalKobo / 100).toString(), reference: "", terminalId: null },
  ]);
  const [saleDate, setSaleDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Registered card terminals for bank_pos rows (offline → no picker, the
  // payment just goes through without one).
  const terminalsQuery = trpc.terminals.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const terminals = terminalsQuery.data ?? [];

  // Customers for credit tabs / regulars — online only: balances live on the
  // server, so credit sales can't be queued offline.
  const customersQuery = trpc.customers.list.useQuery(
    { pageSize: 100 },
    { retry: false, refetchOnWindowFocus: false, enabled: !offlineMode },
  );
  const customerRows = customersQuery.data?.rows ?? [];
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: (data) => {
      setCustomerId(data.id);
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      void customersQuery.refetch();
    },
    onError: (err) => setError(err.message),
  });

  const canBackdate = offlineMode || (user ? roleAtLeast(user.role, "manager") : false);

  const paidKobo = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const n = Number.parseFloat(r.amount);
        return sum + (Number.isFinite(n) && n > 0 ? nairaToKobo(n) : 0);
      }, 0),
    [rows],
  );
  const remainingKobo = totalKobo - paidKobo;
  const changeKobo = Math.max(0, -remainingKobo);

  // Report live payment progress (customer display mirrors this)
  useEffect(() => {
    onProgress?.({
      paidKobo,
      payments: rows
        .map((r) => {
          const n = Number.parseFloat(r.amount);
          return Number.isFinite(n) && n > 0
            ? { label: PAYMENT_METHOD_LABEL[r.method], amountKobo: nairaToKobo(n) }
            : null;
        })
        .filter((p): p is { label: string; amountKobo: number } => p !== null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidKobo, rows, totalKobo]);

  function setRow(index: number, patch: Partial<PaymentRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        method: "bank_pos",
        amount: remainingKobo > 0 ? (remainingKobo / 100).toString() : "",
        reference: "",
        terminalId: null,
      },
    ]);
  }

  async function submit() {
    setError(null);
    const payments = rows
      .map((r) => ({
        method: r.method,
        amount: Number.parseFloat(r.amount),
        reference: r.reference || undefined,
        terminalId:
          r.method === "bank_pos" && r.terminalId !== null ? r.terminalId : undefined,
      }))
      .filter((p) => Number.isFinite(p.amount) && p.amount > 0);

    setSubmitting(true);
    try {
      const sale = await onSubmit({
        items: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          optionIds: l.optionIds,
        })),
        discount: discount && discount.value > 0 ? discount : null,
        payments,
        saleDate: saleDate ? new Date(saleDate).toISOString() : undefined,
        customerId: customerId ?? undefined,
      });
      onCompleted(sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the sale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="royal-scroll relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto border border-royal-line bg-royal-bgsoft">
        <div className="flex items-center justify-between border-b border-royal-line px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              Payment
            </p>
            <p className="mt-1 font-display text-3xl text-royal-cream">
              {formatNaira(totalKobo)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-royal-dim transition-colors hover:text-royal-cream"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
            Split payment
          </p>

          <div className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="border border-royal-line p-4">
                <div className="flex items-center gap-1.5">
                  {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
                    (method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setRow(index, { method, terminalId: null })}
                        className={`flex-1 border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                          row.method === method
                            ? "border-royal-accent bg-royal-faint/40 text-royal-cream"
                            : "border-royal-line text-royal-dim hover:text-royal-cream"
                        }`}
                      >
                        {PAYMENT_METHOD_LABEL[method]}
                      </button>
                    ),
                  )}
                  {rows.length > 1 && (
                    <button
                      type="button"
                      title="Remove this part"
                      onClick={() =>
                        setRows((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="p-2 text-royal-dim transition-colors hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <label className="flex-1">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                      Amount (₦)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => setRow(index, { amount: e.target.value })}
                      className={inputCls}
                    />
                  </label>
                  {row.method !== "cash" && (
                    <label className="flex-1">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                        Reference (optional)
                      </span>
                      <input
                        value={row.reference}
                        onChange={(e) =>
                          setRow(index, { reference: e.target.value })
                        }
                        placeholder={
                          row.method === "bank_pos" ? "Approval code" : "Transfer ref"
                        }
                        className={inputCls}
                      />
                    </label>
                  )}
                </div>
                {row.method === "bank_pos" && terminals.length > 0 && (
                  <label className="mt-3 block">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                      Terminal
                    </span>
                    <select
                      value={row.terminalId ?? ""}
                      onChange={(e) =>
                        setRow(index, {
                          terminalId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full border-b border-royal-line bg-royal-bgsoft py-2 text-sm text-royal-cream focus:border-royal-accent focus:outline-none"
                    >
                      <option value="">— pick the terminal used —</option>
                      {terminals.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.provider ? ` (${t.provider})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>

          {rows.length < 3 && (
            <button
              type="button"
              onClick={addRow}
              className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-royal-accent hover:text-royal-cream"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Split another way
            </button>
          )}

          {/* Balance line */}
          <div className="mt-6 border-t border-royal-line pt-4 text-sm">
            {remainingKobo > 0 ? (
              <p className="flex justify-between text-royal-dim">
                <span>Remaining</span>
                <span className="text-amber-400">{formatNaira(remainingKobo)}</span>
              </p>
            ) : (
              <p className="flex justify-between text-royal-dim">
                <span>Change to give</span>
                <span className={changeKobo > 0 ? "text-emerald-400" : ""}>
                  {formatNaira(changeKobo)}
                </span>
              </p>
            )}
          </div>

          {/* Customer — optional for regulars; REQUIRED when paying short
              (the rest goes on their credit tab). Online only. */}
          {!offlineMode && (
            <div className="mt-5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                Customer{" "}
                {remainingKobo > 0
                  ? "— required, the rest goes on their credit"
                  : "(optional)"}
              </span>
              <div className="mt-2 flex items-end gap-2">
                <select
                  value={customerId ?? ""}
                  onChange={(e) =>
                    setCustomerId(e.target.value ? Number(e.target.value) : null)
                  }
                  className={`${inputCls} bg-royal-bgsoft`}
                >
                  <option value="">— walk-in / no customer —</option>
                  {customerRows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ""}
                      {c.creditBalanceKobo > 0
                        ? ` (owes ${formatNaira(c.creditBalanceKobo)})`
                        : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer((v) => !v)}
                  className="shrink-0 rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:border-royal-accent"
                >
                  New
                </button>
              </div>
              {showNewCustomer && (
                <div className="mt-3 border border-royal-line p-3">
                  <input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Customer name *"
                    className={inputCls}
                  />
                  <input
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className={`${inputCls} mt-2`}
                  />
                  <button
                    type="button"
                    disabled={
                      newCustomerName.trim().length < 2 || createCustomer.isPending
                    }
                    onClick={() =>
                      createCustomer.mutate({
                        name: newCustomerName.trim(),
                        phone: newCustomerPhone.trim() || undefined,
                      })
                    }
                    className="mt-3 flex items-center gap-2 rounded-full bg-royal-accent px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-bg disabled:opacity-50"
                  >
                    {createCustomer.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Add & select
                  </button>
                </div>
              )}
              {remainingKobo > 0 && customerId !== null && (
                <p className="mt-2 border-l-2 border-amber-400/70 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                  {formatNaira(remainingKobo)} goes on{" "}
                  {customerRows.find((c) => c.id === customerId)?.name ?? "the customer"}
                  &apos;s credit tab
                </p>
              )}
            </div>
          )}

          {/* Manual sale date — manager+ (or anyone while offline) */}
          {canBackdate && (
            <label className="mt-5 block">
              <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                {offlineMode
                  ? "Sale date (optional — offline sales only, up to 72h back)"
                  : "Sale date (optional — manager override)"}
              </span>
              <input
                type="datetime-local"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className={`${inputCls} royal-date`}
              />
            </label>
          )}

          {error && (
            <p className="mt-5 border-l-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={
              submitting ||
              (remainingKobo > 0 && (offlineMode || customerId === null))
            }
            onClick={() => void submit()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-royal-accent py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting
              ? "Saving sale…"
              : remainingKobo > 0
                ? offlineMode
                  ? `${formatNaira(remainingKobo)} still due`
                  : customerId === null
                    ? `Pick a customer for the ${formatNaira(remainingKobo)} balance`
                    : `Complete · ${formatNaira(remainingKobo)} on credit`
                : "Complete sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
