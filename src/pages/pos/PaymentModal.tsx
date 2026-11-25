import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
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
  payments: Array<{ method: PaymentMethod; amountKobo: number; reference: string | null }>;
  changeKobo: number;
}

interface PaymentRow {
  method: PaymentMethod;
  /** naira string as typed */
  amount: string;
  reference: string;
}

const inputCls =
  "w-full border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";

export function CheckoutModal({
  totalKobo,
  lines,
  discount,
  onCancel,
  onCompleted,
}: {
  totalKobo: number;
  lines: Array<{ itemId: number; quantity: number; optionIds: number[] }>;
  discount: { type: "percent" | "fixed"; value: number } | null;
  onCancel: () => void;
  onCompleted: (sale: CompletedSaleResult) => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([
    { method: "cash", amount: (totalKobo / 100).toString(), reference: "" },
  ]);
  const [saleDate, setSaleDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const complete = trpc.sales.completeSale.useMutation();
  const canBackdate = user ? roleAtLeast(user.role, "manager") : false;

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
      },
    ]);
  }

  function submit() {
    setError(null);
    const payments = rows
      .map((r) => ({
        method: r.method,
        amount: Number.parseFloat(r.amount),
        reference: r.reference || undefined,
      }))
      .filter((p) => Number.isFinite(p.amount) && p.amount > 0);

    complete.mutate(
      {
        items: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          optionIds: l.optionIds,
        })),
        discount: discount && discount.value > 0 ? discount : null,
        payments,
        saleDate: saleDate ? new Date(saleDate).toISOString() : undefined,
      },
      {
        onSuccess: (sale) => onCompleted(sale as CompletedSaleResult),
        onError: (err) => setError(err.message),
      },
    );
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
                        onClick={() => setRow(index, { method })}
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
                          row.method === "bank_pos" ? "Terminal ref" : "Transfer ref"
                        }
                        className={inputCls}
                      />
                    </label>
                  )}
                </div>
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

          {/* Manual sale date — manager+ */}
          {canBackdate && (
            <label className="mt-5 block">
              <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                Sale date (optional — manager override)
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
            disabled={complete.isPending || remainingKobo > 0}
            onClick={submit}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-royal-accent py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {complete.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {complete.isPending
              ? "Saving sale…"
              : remainingKobo > 0
                ? `${formatNaira(remainingKobo)} still due`
                : "Complete sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
