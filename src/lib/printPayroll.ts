import { formatNaira } from "@contracts/money";
import { getCachedBusinessSettings } from "@/lib/businessSettings";

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dayTime = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} ${new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`;

const periodLabel = (period: string) =>
  new Date(`${period}-02T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 32px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: 0.06em; }
  .muted { color: #666; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  .head .biz { text-align: right; }
  .kpis { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
  .kpi { border: 1px solid #ddd; padding: 10px 14px; min-width: 130px; }
  .kpi b { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 3px; }
  .kpi span { font-size: 15px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; border-bottom: 1px solid #999; padding: 6px 8px; }
  td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .pos { color: #0a7a3d; } .neg { color: #b00020; }
  tfoot td { font-weight: 700; border-top: 2px solid #1a1a1a; border-bottom: none; }
  .foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; }
  .sig { margin-top: 42px; display: flex; gap: 60px; }
  .sig div { border-top: 1px solid #666; padding-top: 4px; font-size: 10px; color: #666; min-width: 180px; }
  @media print { body { margin: 12mm; } }
`;

export interface PrintablePayrollRun {
  period: string;
  status: string;
  totalKobo: number;
  accountName: string | null;
  createdByName: string;
  createdAt: string;
  paidAt: string | null;
  note: string | null;
}

export interface PrintablePayrollItem {
  staffName: string;
  staffCode: string;
  role: string;
  baseKobo: number;
  bonusKobo: number;
  deductionKobo: number;
  netKobo: number;
  note: string | null;
}

/** Payroll sheet: one month, every staff member, base/bonus/deduction/net. */
export function printPayrollRun({
  run,
  items,
}: {
  run: PrintablePayrollRun;
  items: PrintablePayrollItem[];
}): boolean {
  const biz = getCachedBusinessSettings();
  const base = items.reduce((s, i) => s + i.baseKobo, 0);
  const bonus = items.reduce((s, i) => s + i.bonusKobo, 0);
  const deduction = items.reduce((s, i) => s + i.deductionKobo, 0);

  const body = `
  <div class="head">
    <div>
      <h1>Payroll — ${esc(periodLabel(run.period))}</h1>
      <div class="muted">
        Status: ${esc(run.status.toUpperCase())}${run.accountName ? ` · paid from ${esc(run.accountName)}` : ""}
        · prepared by ${esc(run.createdByName)} · generated ${dayTime(new Date().toISOString())}
      </div>
      ${run.note ? `<div class="muted">${esc(run.note)}</div>` : ""}
    </div>
    <div class="biz">
      <strong>${esc(biz?.businessName) || "Royal Bite Kitchen"}</strong><br/>
      ${biz?.businessAddress ? `${esc(biz.businessAddress)}<br/>` : ""}
      ${biz?.businessPhone ? esc(biz.businessPhone) : ""}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><b>Staff paid</b><span>${items.length}</span></div>
    <div class="kpi"><b>Base salaries</b><span>${esc(formatNaira(base))}</span></div>
    <div class="kpi"><b>Bonuses</b><span class="pos">${esc(formatNaira(bonus))}</span></div>
    <div class="kpi"><b>Deductions</b><span class="neg">${esc(formatNaira(deduction))}</span></div>
    <div class="kpi"><b>Net total</b><span>${esc(formatNaira(run.totalKobo))}</span></div>
  </div>

  <table>
    <thead>
      <tr><th>Staff</th><th>Code</th><th>Role</th><th class="r">Base</th><th class="r">Bonus</th><th class="r">Deduction</th><th class="r">Net pay</th><th>Note</th></tr>
    </thead>
    <tbody>
      ${items
        .map(
          (i) => `<tr>
        <td>${esc(i.staffName)}</td>
        <td>${esc(i.staffCode)}</td>
        <td>${esc(i.role)}</td>
        <td class="r">${esc(formatNaira(i.baseKobo))}</td>
        <td class="r pos">${i.bonusKobo ? esc(formatNaira(i.bonusKobo)) : ""}</td>
        <td class="r neg">${i.deductionKobo ? esc(formatNaira(i.deductionKobo)) : ""}</td>
        <td class="r"><strong>${esc(formatNaira(i.netKobo))}</strong></td>
        <td>${esc(i.note ?? "")}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">Total</td>
        <td class="r">${esc(formatNaira(base))}</td>
        <td class="r">${esc(formatNaira(bonus))}</td>
        <td class="r">${esc(formatNaira(deduction))}</td>
        <td class="r">${esc(formatNaira(run.totalKobo))}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="sig">
    <div>Prepared by</div>
    <div>Approved by</div>
    <div>Received by (staff)</div>
  </div>

  <div class="foot">
    <span class="muted">${items.length} staff · ${esc(periodLabel(run.period))}</span>
    <span class="muted">Generated by ${esc(biz?.businessName) || "Royal Bite Kitchen"} POS</span>
  </div>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Payroll ${esc(run.period)}</title>
<style>${BASE_CSS}</style></head>
<body>${body}
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
