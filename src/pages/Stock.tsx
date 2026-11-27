import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  Loader2,
  Package,
  PackageX,
  Plus,
  Printer,
  Search,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";
import { formatQty } from "@contracts/stock";
import { usePerms } from "@/lib/perms";
import { printStockList } from "@/lib/printStock";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StockPage() {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const { has } = usePerms();
  const canManage = has("stock", "manage");

  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const list = trpc.stock.list.useQuery({
    search: search || undefined,
    lowOnly,
    includeInactive: canManage,
  });
  const summary = trpc.stock.summary.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit: "",
    openingQuantity: "",
    lowStockAt: "",
    costPerUnit: "",
  });
  const [notice, setNotice] = useState<string | null>(null);

  const createMutation = trpc.stock.create.useMutation({
    onSuccess: (created) => {
      utils.stock.list.invalidate();
      utils.stock.summary.invalidate();
      setForm({ name: "", unit: "", openingQuantity: "", lowStockAt: "", costPerUnit: "" });
      setShowCreate(false);
      setNotice("Stock item added — staff can now record movements against it.");
      navigate(`/stock/${created.id}`);
    },
    onError: (err) => setNotice(err.message),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    createMutation.mutate({
      name: form.name,
      unit: form.unit,
      openingQuantity: form.openingQuantity ? Number.parseFloat(form.openingQuantity) : 0,
      lowStockAt: form.lowStockAt ? Number.parseFloat(form.lowStockAt) : null,
      costPerUnit: form.costPerUnit ? Number.parseFloat(form.costPerUnit) : null,
    });
  }

  const rows = list.data?.rows ?? [];

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Stock & inventory
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Ingredients and supplies with a full movement ledger. Tap any item
            for its stock card — history, filters and printing live there.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid="stock-print"
            disabled={list.isLoading || rows.length === 0}
            onClick={() =>
              printStockList(rows, { search: search || undefined, lowOnly })
            }
            className="flex items-center gap-2 rounded-full border border-royal-line px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-cream disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={2} />
            Print
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New item
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="stock-kpis">
        <KpiCard
          icon={<Package className="h-4 w-4" strokeWidth={1.75} />}
          label="Items tracked"
          value={summary.isLoading ? "…" : String(summary.data?.totalItems ?? 0)}
          testid="stock-kpi-items"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" strokeWidth={1.75} />}
          label="Low stock"
          value={summary.isLoading ? "…" : String(summary.data?.lowCount ?? 0)}
          tone={(summary.data?.lowCount ?? 0) > 0 ? "warn" : "plain"}
          testid="stock-kpi-low"
        />
        <KpiCard
          icon={<PackageX className="h-4 w-4" strokeWidth={1.75} />}
          label="Out of stock"
          value={summary.isLoading ? "…" : String(summary.data?.outOfStockCount ?? 0)}
          tone={(summary.data?.outOfStockCount ?? 0) > 0 ? "bad" : "plain"}
          testid="stock-kpi-out"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" strokeWidth={1.75} />}
          label="Stock value"
          value={summary.isLoading ? "…" : formatNaira(summary.data?.stockValueKobo ?? 0)}
          testid="stock-kpi-value"
        />
        <KpiCard
          icon={<ArrowDownToLine className="h-4 w-4" strokeWidth={1.75} />}
          label="Movements today"
          value={summary.isLoading ? "…" : String(summary.data?.movementsToday ?? 0)}
          testid="stock-kpi-moves"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" strokeWidth={1.75} />}
          label="Restock spend today"
          value={summary.isLoading ? "…" : formatNaira(summary.data?.restockSpendTodayKobo ?? 0)}
          testid="stock-kpi-spend"
        />
      </div>

      {notice && (
        <div className="border border-royal-line bg-royal-panel px-4 py-3 text-sm text-royal-cream">
          {notice}
        </div>
      )}

      {/* Create form (manager+) */}
      {showCreate && canManage && (
        <form onSubmit={handleCreate} className="border border-royal-line bg-royal-panel p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Add a stock item
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Rice (50kg bag)"
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <div>
              <label className={labelCls}>Unit *</label>
              <input
                className={inputCls}
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="kg / L / pack / pcs"
                required
                maxLength={20}
              />
            </div>
            <div>
              <label className={labelCls}>Opening quantity</label>
              <input
                type="number"
                min="0"
                step="0.001"
                className={inputCls}
                value={form.openingQuantity}
                onChange={(e) => setForm((f) => ({ ...f, openingQuantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>Low-stock alert at</label>
              <input
                type="number"
                min="0"
                step="0.001"
                className={inputCls}
                value={form.lowStockAt}
                onChange={(e) => setForm((f) => ({ ...f, lowStockAt: e.target.value }))}
                placeholder="Optional — e.g. 5"
              />
            </div>
            <div>
              <label className={labelCls}>Cost per unit (₦)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={form.costPerUnit}
                onChange={(e) => setForm((f) => ({ ...f, costPerUnit: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-opacity disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              )}
              Add item
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-full border border-royal-line px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 border-b border-royal-line pb-2">
          <Search className="h-4 w-4 shrink-0 text-royal-dim" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full bg-transparent text-sm text-royal-cream placeholder:text-royal-dim/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setLowOnly((v) => !v)}
          data-testid="stock-lowonly"
          className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
            lowOnly
              ? "border-amber-400 bg-amber-400/10 text-amber-300"
              : "border-royal-line text-royal-dim hover:text-royal-cream"
          }`}
        >
          Low stock only
        </button>
      </div>

      {/* List */}
      {list.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-royal-line px-6 py-10 text-center">
          <Package className="mx-auto h-8 w-8 text-royal-dim" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-royal-dim">
            {search || lowOnly
              ? "No items match that filter."
              : "No stock items yet — a manager adds the first one."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-royal-line border border-royal-line">
          {rows.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/stock/${item.id}`)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-royal-faint/20"
              data-testid={`stock-row-${item.id}`}
            >
              <Package
                className={`h-5 w-5 shrink-0 ${item.active ? "text-royal-accent" : "text-royal-dim"}`}
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-royal-cream">
                  {item.name}
                  {!item.active && (
                    <span className="ml-2 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      deactivated
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-royal-dim">
                  {item.costPerUnitKobo !== null
                    ? `${formatNaira(item.costPerUnitKobo)} / ${item.unit}`
                    : "No cost set"}
                  {item.lastMovementAt ? ` · last move ${fmtDate(item.lastMovementAt)}` : ""}
                </p>
              </div>
              {item.quantityMilli <= 0 && item.active ? (
                <span className="shrink-0 rounded-full border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-400">
                  Out of stock
                </span>
              ) : item.low ? (
                <span className="shrink-0 rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-400">
                  Low · {formatQty(item.quantityMilli)} {item.unit}
                </span>
              ) : (
                <span className="shrink-0 text-sm font-semibold text-royal-cream">
                  {formatQty(item.quantityMilli)} {item.unit}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone = "plain",
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "plain" | "warn" | "bad";
  testid: string;
}) {
  const color =
    tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-rose-400" : "text-royal-cream";
  return (
    <div className="border border-royal-line bg-royal-panel px-4 py-3.5" data-testid={testid}>
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
        {icon}
        {label}
      </p>
      <p className={`mt-1.5 truncate font-display text-xl ${color}`}>{value}</p>
    </div>
  );
}
