import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  Loader2,
  Receipt,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";

const ACCENT = "#C084FC";
const PRIMARY = "#9333EA";
const DIM = "#B3A897";
const LINE = "#3B2560";

type RangeKey = "today" | "yesterday" | "week" | "month" | "custom";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFor(key: RangeKey, customFrom: string, customTo: string) {
  const today = new Date();
  const from = new Date();
  switch (key) {
    case "today":
      break;
    case "yesterday":
      from.setDate(from.getDate() - 1);
      today.setDate(today.getDate() - 1);
      break;
    case "week":
      from.setDate(from.getDate() - 6);
      break;
    case "month":
      from.setDate(from.getDate() - 29);
      break;
    case "custom":
      return { from: customFrom, to: customTo };
  }
  return { from: isoDay(from), to: isoDay(today) };
}

function KpiTile({ label, value, testid, tone }: { label: string; value: string; testid: string; tone?: "accent" | "red" }) {
  return (
    <div className="border border-royal-line bg-royal-panel px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          tone === "accent" ? "text-royal-accent" : tone === "red" ? "text-red-300" : "text-royal-cream"
        }`}
        data-testid={testid}
      >
        {value}
      </p>
    </div>
  );
}

/** Ranked horizontal bars, hand-rolled for a cleaner editorial look. */
function BarList({
  rows,
  testid,
  empty,
}: {
  rows: { label: string; value: string; pct: number; sub?: string }[];
  testid: string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-royal-dim">{empty}</p>;
  return (
    <div className="mt-4 space-y-3" data-testid={testid}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm text-royal-cream">
              <span className="mr-2 text-[10px] uppercase tracking-[0.2em] text-royal-dim">{i + 1}</span>
              {r.label}
            </p>
            <p className="shrink-0 text-sm font-semibold text-royal-accent">{r.value}</p>
          </div>
          <div className="mt-1 h-1.5 w-full bg-royal-faint">
            <div
              className="h-full bg-gradient-to-r from-royal-primary to-royal-accent"
              style={{ width: `${Math.max(2, Math.round(r.pct * 100))}%` }}
            />
          </div>
          {r.sub && <p className="mt-0.5 text-[11px] text-royal-dim">{r.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border border-royal-line bg-royal-panel p-6">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

const TONE_STYLE: Record<string, { border: string; icon: React.ReactNode; label: string }> = {
  bad: {
    border: "border-red-400/50",
    icon: <XCircle className="h-4 w-4 shrink-0 text-red-300" strokeWidth={2} />,
    label: "text-red-300",
  },
  warn: {
    border: "border-amber-400/50",
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={2} />,
    label: "text-amber-300",
  },
  good: {
    border: "border-royal-accent/50",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-royal-accent" strokeWidth={2} />,
    label: "text-royal-accent",
  },
  info: {
    border: "border-royal-line",
    icon: <Info className="h-4 w-4 shrink-0 text-royal-dim" strokeWidth={2} />,
    label: "text-royal-cream",
  },
};

function InsightsSection({ range }: { range: { from: string; to: string } }) {
  const query = trpc.insights.generate.useQuery(range);
  const insights = query.data?.insights ?? [];

  return (
    <section className="border border-royal-line bg-royal-panel p-6" data-testid="insights">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          Insights for this period
        </p>
        {query.data?.generatedAt && (
          <p className="text-[11px] text-royal-dim">
            computed {new Date(query.data.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
      {query.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Analysing…
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {insights.map((i) => {
            const tone = TONE_STYLE[i.tone] ?? TONE_STYLE.info;
            return (
              <div
                key={i.id}
                className={`border ${tone.border} bg-royal-bg px-4 py-3`}
                data-testid={`insight-${i.id}`}
              >
                <p className={`flex items-center gap-2 text-sm font-semibold ${tone.label}`}>
                  {tone.icon}
                  {i.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-5 text-royal-dim">{i.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "#1E0F35",
    border: `1px solid ${LINE}`,
    borderRadius: 0,
    fontSize: 12,
  },
  labelStyle: { color: DIM },
  itemStyle: { color: ACCENT },
};

export default function ReportsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date()));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));

  const range = useMemo(
    () => rangeFor(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );

  const overview = trpc.reports.overview.useQuery(range);
  const daily = trpc.reports.daily.useQuery(range);
  const topItems = trpc.reports.topItems.useQuery({ ...range, limit: 10 });
  const payments = trpc.reports.paymentMethods.useQuery(range);
  const cats = trpc.reports.categories.useQuery(range);
  const staff = trpc.reports.staff.useQuery(range);
  const hours = trpc.reports.hours.useQuery(range);
  const expenseCats = trpc.reports.expenseCategories.useQuery(range);

  const o = overview.data;
  const loading = overview.isLoading;

  const maxTop = Math.max(1, ...(topItems.data?.items ?? []).map((i) => i.revenueKobo));
  const maxPay = Math.max(1, ...(payments.data?.methods ?? []).map((m) => m.totalKobo));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Reports & analytics
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Revenue, top sellers, payment mix, staff performance and expense
            trends for any period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                rangeKey === r.key
                  ? "border-royal-accent bg-royal-accent text-royal-bg"
                  : "border-royal-line text-royal-dim hover:text-royal-cream"
              }`}
              data-testid={`range-${r.key}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {rangeKey === "custom" && (
        <div className="flex flex-wrap items-center gap-6 border border-royal-line bg-royal-panel px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">From</p>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="royal-date mt-1 border-b border-royal-line bg-transparent py-1.5 text-sm text-royal-cream focus:border-royal-accent focus:outline-none"
              data-testid="custom-from"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">To</p>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="royal-date mt-1 border-b border-royal-line bg-transparent py-1.5 text-sm text-royal-cream focus:border-royal-accent focus:outline-none"
              data-testid="custom-to"
            />
          </div>
          <p className="text-xs text-royal-dim">
            {range.from} → {range.to}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading reports…
        </div>
      ) : (
        <>
          <InsightsSection range={range} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Revenue" value={formatNaira(o?.revenueKobo ?? 0)} testid="kpi-revenue" tone="accent" />
            <KpiTile label="Sales" value={String(o?.salesCount ?? 0)} testid="kpi-sales" />
            <KpiTile label="Average ticket" value={formatNaira(o?.avgTicketKobo ?? 0)} testid="kpi-avg" />
            <KpiTile label="Items sold" value={String(o?.itemsSold ?? 0)} testid="kpi-items" />
            <KpiTile label="Expenses" value={formatNaira(o?.expensesKobo ?? 0)} testid="kpi-expenses" tone="red" />
            <KpiTile label="Net (revenue − expenses)" value={formatNaira(o?.netKobo ?? 0)} testid="kpi-net" />
            <KpiTile label="Discounts given" value={formatNaira(o?.discountKobo ?? 0)} testid="kpi-discounts" />
            <KpiTile label="Returns" value={String(o?.returnsCount ?? 0)} testid="kpi-returns" />
          </div>

          <Section icon={<TrendingUp className="h-4 w-4" strokeWidth={2} />} title="Daily revenue">
            {(daily.data?.days ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-royal-dim">No sales in this period.</p>
            ) : (
              <div className="mt-4 h-64" data-testid="daily-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily.data?.days ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: DIM, fontSize: 11 }} stroke={LINE} />
                    <YAxis
                      tick={{ fill: DIM, fontSize: 11 }}
                      stroke={LINE}
                      tickFormatter={(v: number) => `₦${Math.round(v / 100000)}k`}
                      width={56}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [formatNaira(v), "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenueKobo" stroke={ACCENT} strokeWidth={2} fill="url(#rev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section icon={<Trophy className="h-4 w-4" strokeWidth={2} />} title="Top-selling items">
              <BarList
                testid="top-items"
                empty="No items sold in this period."
                rows={(topItems.data?.items ?? []).map((i) => ({
                  label: i.itemName,
                  value: formatNaira(i.revenueKobo),
                  pct: i.revenueKobo / maxTop,
                  sub: `${i.quantity} sold`,
                }))}
              />
            </Section>

            <Section icon={<CreditCard className="h-4 w-4" strokeWidth={2} />} title="Payment methods">
              <BarList
                testid="payment-methods"
                empty="No payments in this period."
                rows={(payments.data?.methods ?? []).map((m) => ({
                  label: m.method === "bank_pos" ? "Bank POS" : m.method[0].toUpperCase() + m.method.slice(1),
                  value: formatNaira(m.totalKobo),
                  pct: m.totalKobo / maxPay,
                  sub: `${m.payments} payment${m.payments === 1 ? "" : "s"}`,
                }))}
              />
            </Section>

            <Section icon={<BarChart3 className="h-4 w-4" strokeWidth={2} />} title="Sales by category">
              <BarList
                testid="category-breakdown"
                empty="No category sales in this period."
                rows={(cats.data?.categories ?? []).map((c) => ({
                  label: c.categoryName,
                  value: formatNaira(c.revenueKobo),
                  pct:
                    c.revenueKobo /
                    Math.max(1, ...(cats.data?.categories ?? []).map((x) => x.revenueKobo)),
                  sub: `${c.quantity} items`,
                }))}
              />
            </Section>

            <Section icon={<Clock3 className="h-4 w-4" strokeWidth={2} />} title="Peak hours">
              {(hours.data?.hours ?? []).length === 0 ? (
                <p className="mt-4 text-sm text-royal-dim">No sales in this period.</p>
              ) : (
                <div className="mt-4 h-56" data-testid="hours-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hours.data?.hours ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: DIM, fontSize: 11 }}
                        stroke={LINE}
                        tickFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
                      />
                      <YAxis tick={{ fill: DIM, fontSize: 11 }} stroke={LINE} allowDecimals={false} width={40} />
                      <Tooltip
                        {...tooltipStyle}
                        labelFormatter={(h: number) => `${String(h).padStart(2, "0")}:00 – ${String((h + 1) % 24).padStart(2, "0")}:00`}
                        formatter={(v: number, name: string) => [
                          name === "revenueKobo" ? formatNaira(v) : v,
                          name === "revenueKobo" ? "Revenue" : "Sales",
                        ]}
                      />
                      <Bar dataKey="salesCount" fill={ACCENT} radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section icon={<Users className="h-4 w-4" strokeWidth={2} />} title="Staff performance">
              {(staff.data?.staff ?? []).length === 0 ? (
                <p className="mt-4 text-sm text-royal-dim">No sales in this period.</p>
              ) : (
                <div className="mt-4 divide-y divide-royal-line border border-royal-line" data-testid="staff-table">
                  {(staff.data?.staff ?? []).map((s) => (
                    <div key={s.staffCode} className="flex items-center gap-4 px-5 py-3" data-testid={`staff-row-${s.staffCode}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-royal-cream">{s.staffName}</p>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-royal-dim">{s.staffCode}</p>
                      </div>
                      <p className="text-xs text-royal-dim">{s.salesCount} sales</p>
                      <p className="text-sm font-bold text-royal-accent">{formatNaira(s.revenueKobo)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={<Receipt className="h-4 w-4" strokeWidth={2} />} title="Expenses by category">
              <BarList
                testid="expense-categories"
                empty="No expenses in this period."
                rows={(expenseCats.data?.categories ?? []).map((c) => ({
                  label: c.category[0].toUpperCase() + c.category.slice(1),
                  value: formatNaira(c.totalKobo),
                  pct:
                    c.totalKobo /
                    Math.max(1, ...(expenseCats.data?.categories ?? []).map((x) => x.totalKobo)),
                  sub: `${c.count} expense${c.count === 1 ? "" : "s"}`,
                }))}
              />
            </Section>
          </div>

          <p className="flex items-center gap-2 text-[11px] text-royal-dim">
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
            Figures cover completed, non-returned sales between {range.from} and {range.to} inclusive.
          </p>
        </>
      )}
    </div>
  );
}
