import { Printer, Plus, X } from "lucide-react";
import { formatNaira } from "@contracts/money";
import { PAYMENT_METHOD_LABEL } from "@contracts/payments";
import type { CompletedSaleResult } from "./PaymentModal";

const STORE_NAME = "Royal Bite Kitchen";
const STORE_LINE = "Thank you for dining with us";

function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** The printable receipt itself — rendered on-screen styled like thermal paper
 *  and picked up by the @media print rules in index.css. */
export function ReceiptPaper({ sale }: { sale: CompletedSaleResult }) {
  return (
    <div id="receipt-paper" className="w-full bg-[#fdfbf7] px-4 py-5 font-mono text-[11px] leading-relaxed text-neutral-900">
      <div className="text-center">
        <p className="text-[15px] font-bold tracking-wide">{STORE_NAME}</p>
        <p className="mt-0.5 text-[10px] text-neutral-500">
          {formatReceiptDate(sale.soldAt)}
        </p>
        <p className="mt-1 text-[11px] font-semibold">
          Receipt {sale.receiptNo}
        </p>
        <p className="text-[10px] text-neutral-500">
          Served by {sale.cashierName}
        </p>
      </div>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <div>
        {sale.lines.map((line, i) => (
          <div key={i} className="mb-1.5">
            <div className="flex justify-between gap-2">
              <span className="break-words">
                {line.quantity}× {line.itemName}
              </span>
              <span className="shrink-0 font-semibold">
                {formatNaira(line.lineTotalKobo)}
              </span>
            </div>
            {line.modifiers.map((m, j) => (
              <p key={j} className="pl-3 text-[10px] text-neutral-600">
                · {m.group}: {m.option}
                {m.priceDeltaKobo > 0 &&
                  ` (+${formatNaira(m.priceDeltaKobo)})`}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatNaira(sale.subtotalKobo)}</span>
        </div>
        {sale.discountKobo > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatNaira(sale.discountKobo)}</span>
          </div>
        )}
        <div className="flex justify-between text-[13px] font-bold">
          <span>TOTAL</span>
          <span>{formatNaira(sale.totalKobo)}</span>
        </div>
      </div>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <div className="space-y-0.5">
        {sale.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>
              {PAYMENT_METHOD_LABEL[p.method]}
              {p.reference ? ` (${p.reference})` : ""}
            </span>
            <span>{formatNaira(p.amountKobo)}</span>
          </div>
        ))}
        {sale.changeKobo > 0 && (
          <div className="flex justify-between font-semibold">
            <span>Change</span>
            <span>{formatNaira(sale.changeKobo)}</span>
          </div>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <p className="text-center text-[10px] text-neutral-500">{STORE_LINE}</p>
    </div>
  );
}

/** Post-checkout modal: receipt preview + print + start-new-sale. */
export function ReceiptView({
  sale,
  onNewSale,
  onClose,
}: {
  sale: CompletedSaleResult;
  onNewSale: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-sm flex-col border border-royal-line bg-royal-bgsoft">
        <div className="flex items-center justify-between border-b border-royal-line px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              Sale complete
            </p>
            <p className="mt-0.5 text-sm text-royal-cream">
              {sale.receiptNo} · {formatNaira(sale.totalKobo)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-royal-dim transition-colors hover:text-royal-cream"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="royal-scroll flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[280px] shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            <ReceiptPaper sale={sale} />
          </div>
        </div>

        <div className="flex gap-3 border-t border-royal-line px-5 py-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-royal-accent py-3 text-xs font-semibold uppercase tracking-[0.18em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
          >
            <Printer className="h-4 w-4" strokeWidth={1.75} />
            Print receipt
          </button>
          <button
            type="button"
            onClick={onNewSale}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-royal-line py-3 text-xs font-semibold uppercase tracking-[0.18em] text-royal-cream transition-colors hover:border-royal-accent hover:text-royal-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New sale
          </button>
        </div>
      </div>
    </div>
  );
}
