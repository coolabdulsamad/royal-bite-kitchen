import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Package,
  Pencil,
  Power,
  PowerOff,
  Printer,
  Scale,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatNaira } from "@contracts/money";
import {
  formatQty,
  STOCK_MOVEMENT_LABEL,
  STOCK_MOVEMENT_TYPES,
  type StockMovementType,
} from "@contracts/stock";
import { usePerms } from "@/lib/perms";
import { printStockCard } from "@/lib/printStock";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

const MOVE_ICON: Record<StockMovementType, typeof ArrowDownToLine> = {
  restock: ArrowDownToLine,
  usage: ArrowUpFromLine,
  waste: Trash2,
  adjustment: Scale,
};

const PAGE_SIZE = 25;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StockItemPage() {
  const params = useParams();
  const itemId = Number(params.id);
  const utils = trpc.useUtils();
  const { has } = usePerms();
  const canManage = has("stock", "manage");

  // ---- filters -------------------------------------------------------------
  const [typeFilter, setTypeFilter] = useState<StockMovementType | "">("");
  const [staffFilter, setStaffFilter] = useState<number | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filtersActive = typeFilter !== "" || staffFilter !== "" || from !== "" || to !== "";

  function resetPage() {
    setPage(1);
  }
  function clearFilters() {
    setTypeFilter("");
    setStaffFilter("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const detail = trpc.stock.detail.useQuery(
    {
      itemId,
      type: typeFilter || undefined,
      staffId: staffFilter === "" ? undefined : staffFilter,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    { enabled: Number.isFinite(itemId) && itemId > 0 },
  );
  const staffNames = trpc.staff.names.useQuery();

  const item = detail.data?.item;
  const totals = detail.data?.totals;
  const movements = detail.data?.movements ?? [];
  const total = detail.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ---- mutations ------------------------------------------------------------
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", unit: "", lowStockAt: "", costPerUnit: "" });
  const [moveType, setMoveType] = useState<StockMovementType>("restock");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [totalCost, setTotalCost] = useState("");

  function refresh() {
    utils.stock.detail.invalidate({ itemId });
    utils.stock.list.invalidate();
    utils.stock.summary.invalidate();
    utils.notifications.feed.invalidate();
  }

  const moveMutation = trpc.stock.move.useMutation({
    onSuccess: () => {
      setQuantity("");
      setNote("");
      setTotalCost("");
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const adjustMutation = trpc.stock.adjust.useMutation({
    onSuccess: () => {
      setQuantity("");
      setNote("");
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const updateMutation = trpc.stock.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });

  const busy = moveMutation.isPending || adjustMutation.isPending || updateMutation.isPending;
  const qtyNum = Number.parseFloat(quantity);
  const qtyValid = Number.isFinite(qtyNum) && qtyNum >= 0;
  const canSubmit =
    !busy && item?.active && qtyValid && (moveType === "adjustment" ? note.trim().length >= 3 : qtyNum > 0);

  function submitMove() {
    setError(null);
    if (moveType === "adjustment") {
      adjustMutation.mutate({ itemId, newQuantity: qtyNum, note: note.trim() });
    } else {
      moveMutation.mutate({
        itemId,
        type: moveType,
        quantity: qtyNum,
        note: note.trim() || undefined,
        totalCost: moveType === "restock" && totalCost ? Number.parseFloat(totalCost) : undefined,
      });
    }
  }

  function filterNote(): string {
    const parts: string[] = [];
    if (typeFilter) parts.push(STOCK_MOVEMENT_LABEL[typeFilter]);
    if (staffFilter !== "") {
      const s = (staffNames.data ?? []).find((n) => n.id === staffFilter);
      parts.push(`by ${s?.name ?? `#${staffFilter}`}`);
    }
    if (from || to) parts.push(`${from || "…"} → ${to || todayIso()}`);
    return parts.length ? parts.join(" · ") : "all movements";
  }

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return (
      <div className="border border-dashed border-royal-line px-6 py-10 text-center text-sm text-royal-dim">
        Unknown stock item. <Link to="/stock" className="text-royal-accent underline">Back to stock</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/stock"
            data-testid="stock-back"
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim transition-colors hover:text-royal-cream"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Stock
          </Link>
          {item ? (
            <div className="mt-3">
              <p className="font-display text-3xl text-royal-cream" data-testid="stock-item-name">
                {item.name}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-royal-dim">
                <span>counted in {item.unit}</span>
                <span>·</span>
                <span>
                  added {fmtDate(item.createdAt)}
                  {item.createdByName ? ` by ${item.createdByName}` : ""}
                </span>
                {!item.active && (
                  <span className="rounded-full border border-royal-line px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-royal-dim">
                    deactivated
                  </span>
                )}
                {item.active && item.quantityMilli <= 0 && (
                  <span className="rounded-full border border-rose-500/40 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-400">
                    out of stock
                  </span>
                )}
                {item.active && item.low && item.quantityMilli > 0 && (
                  <span className="rounded-full border border-amber-400/40 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400">
                    low stock
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm text-royal-dim">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
            </div>
          )}
        </div>
        {item && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="stock-detail-print"
              onClick={() =>
                detail.data &&
                printStockCard({
                  item: detail.data.item,
                  totals: detail.data.totals,
                  movements: detail.data.movements,
                  total: detail.data.total,
                  filterNote: filterNote(),
                })
              }
              className="flex items-center gap-2 rounded-full border border-royal-line px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-cream"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={2} />
              Print
            </button>
            {canManage && item.active && (
              <button
                type="button"
                data-testid="stock-move-toggle"
                onClick={() => setShowMove((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-opacity hover:opacity-90"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={2} />
                Record movement
              </button>
            )}
            {canManage && (
              <>
                <button
                  type="button"
                  data-testid="stock-edit-toggle"
                  onClick={() => {
                    setEditing((v) => !v);
                    setEditForm({
                      name: item.name,
                      unit: item.unit,
                      lowStockAt: item.lowStockAtMilli !== null ? (item.lowStockAtMilli / 1000).toString() : "",
                      costPerUnit: item.costPerUnitKobo !== null ? (item.costPerUnitKobo / 100).toString() : "",
                    });
                  }}
                  className="flex items-center gap-2 rounded-full border border-royal-line px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-cream"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  Edit
                </button>
                <button
                  type="button"
                  data-testid="stock-active-toggle"
                  disabled={busy}
                  onClick={() => updateMutation.mutate({ id: itemId, active: !item.active })}
                  className="flex items-center gap-2 rounded-full border border-royal-line px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:border-rose-500/60 hover:text-rose-300"
                >
                  {item.active ? (
                    <PowerOff className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Power className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {item.active ? "Deactivate" : "Reactivate"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="border-l-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}

      {/* KPI cards */}
      {item && totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="stock-item-kpis">
          <KpiCard label="On hand" value={`${formatQty(item.quantityMilli)} ${item.unit}`} tone={item.quantityMilli <= 0 ? "bad" : item.low ? "warn" : "plain"} testid="item-kpi-onhand" />
          <KpiCard label="Stock value" value={formatNaira(item.stockValueKobo)} testid="item-kpi-value" />
          <KpiCard label="Restocked" value={`+${formatQty(totals.restockedMilli)} ${item.unit}`} tone="good" testid="item-kpi-restocked" />
          <KpiCard label="Used" value={`−${formatQty(totals.usageMilli)} ${item.unit}`} tone="warn" testid="item-kpi-used" />
          <KpiCard label="Wasted" value={`−${formatQty(totals.wasteMilli)} ${item.unit}`} tone="warn" testid="item-kpi-wasted" />
          <KpiCard label="Restock spend" value={formatNaira(totals.spendKobo)} testid="item-kpi-spend" />
        </div>
      )}
      {item && totals && totals.adjustmentNetMilli !== 0 && (
        <p className="text-xs text-royal-dim">
          Net corrections in this view: {totals.adjustmentNetMilli >= 0 ? "+" : "−"}
          {formatQty(Math.abs(totals.adjustmentNetMilli))} {item.unit} · movements match the filters below.
        </p>
      )}

      {/* Edit form (manager+) */}
      {editing && canManage && item && (
        <div className="border border-royal-line bg-royal-panel p-6" data-testid="stock-edit-form">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">Edit item</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} data-testid="stock-edit-name" />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <input className={inputCls} value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Low-stock alert at</label>
              <input type="number" min="0" step="0.001" className={inputCls} value={editForm.lowStockAt} onChange={(e) => setEditForm((f) => ({ ...f, lowStockAt: e.target.value }))} data-testid="stock-edit-low" />
            </div>
            <div>
              <label className={labelCls}>Cost per unit (₦)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={editForm.costPerUnit} onChange={(e) => setEditForm((f) => ({ ...f, costPerUnit: e.target.value }))} />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={busy || editForm.name.trim().length < 2}
              onClick={() =>
                updateMutation.mutate({
                  id: itemId,
                  name: editForm.name.trim(),
                  unit: editForm.unit.trim(),
                  lowStockAt: editForm.lowStockAt ? Number.parseFloat(editForm.lowStockAt) : null,
                  costPerUnit: editForm.costPerUnit ? Number.parseFloat(editForm.costPerUnit) : null,
                })
              }
              className="rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg disabled:opacity-50"
              data-testid="stock-edit-save"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-royal-line px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Record a movement (manager+) */}
      {showMove && canManage && item?.active && (
        <div className="border border-royal-line bg-royal-panel p-6" data-testid="stock-move-form">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">Record a movement</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {STOCK_MOVEMENT_TYPES.map((t) => {
              const Icon = MOVE_ICON[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMoveType(t)}
                  data-testid={`move-type-${t}`}
                  className={`flex items-center gap-1.5 border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    moveType === t
                      ? "border-royal-accent bg-royal-faint/40 text-royal-cream"
                      : "border-royal-line text-royal-dim hover:text-royal-cream"
                  }`}
                >
                  <Icon className="h-3 w-3" strokeWidth={2} />
                  {STOCK_MOVEMENT_LABEL[t]}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            <label className="block">
              <span className={labelCls}>
                {moveType === "adjustment" ? `Counted quantity (${item.unit})` : `Quantity (${item.unit})`}
              </span>
              <input type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} placeholder="0" data-testid="move-quantity" />
            </label>
            {moveType === "restock" && (
              <label className="block">
                <span className={labelCls}>Total cost (₦, optional)</span>
                <input type="number" min="0" step="0.01" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className={inputCls} placeholder="What you paid in total" data-testid="move-cost" />
              </label>
            )}
            <label className="block">
              <span className={labelCls}>{moveType === "adjustment" ? "Why the correction? (required)" : "Note (optional)"}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} className={inputCls} data-testid="move-note" />
            </label>
          </div>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submitMove}
            className="mt-4 flex items-center gap-2 rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg disabled:opacity-50"
            data-testid="move-save"
          >
            {(moveMutation.isPending || adjustMutation.isPending) && (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
            )}
            Save {STOCK_MOVEMENT_LABEL[moveType].toLowerCase()}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3" data-testid="stock-filters">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-royal-dim" strokeWidth={2} />
          <button
            type="button"
            onClick={() => { setTypeFilter(""); resetPage(); }}
            data-testid="filter-type-all"
            className={`rounded-full border px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] transition-colors ${
              typeFilter === "" ? "border-royal-accent bg-royal-faint/40 text-royal-cream" : "border-royal-line text-royal-dim hover:text-royal-cream"
            }`}
          >
            All
          </button>
          {STOCK_MOVEMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTypeFilter(t); resetPage(); }}
              data-testid={`filter-type-${t}`}
              className={`rounded-full border px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                typeFilter === t ? "border-royal-accent bg-royal-faint/40 text-royal-cream" : "border-royal-line text-royal-dim hover:text-royal-cream"
              }`}
            >
              {STOCK_MOVEMENT_LABEL[t]}
            </button>
          ))}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              data-testid="filter-clear"
              className="flex items-center gap-1 rounded-full border border-rose-500/40 px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              <X className="h-3 w-3" strokeWidth={2} /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className={labelCls}>Staff</span>
            <select
              value={staffFilter}
              onChange={(e) => { setStaffFilter(e.target.value === "" ? "" : Number(e.target.value)); resetPage(); }}
              data-testid="filter-staff"
              className="mt-1 border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream focus:border-royal-accent focus:outline-none [&>option]:bg-royal-panel"
            >
              <option value="">Everyone</option>
              {(staffNames.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); resetPage(); }} data-testid="filter-from"
              className="mt-1 border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none" />
          </label>
          <label className="block">
            <span className={labelCls}>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); resetPage(); }} data-testid="filter-to"
              className="mt-1 border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream [color-scheme:dark] focus:border-royal-accent focus:outline-none" />
          </label>
        </div>
      </div>

      {/* Movement ledger */}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Movement history
          </p>
          <p className="text-xs text-royal-dim" data-testid="movement-count">
            {total} movement{total === 1 ? "" : "s"}{filtersActive ? " · filtered" : ""}
          </p>
        </div>
        {detail.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-royal-dim">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
          </div>
        ) : movements.length === 0 ? (
          <div className="mt-3 border border-dashed border-royal-line px-6 py-10 text-center">
            <Package className="mx-auto h-8 w-8 text-royal-dim" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-royal-dim">
              {filtersActive ? "No movements match those filters." : "No movements yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto border border-royal-line">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-royal-line text-[9px] font-semibold uppercase tracking-[0.2em] text-royal-dim">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Change</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-royal-line/60">
                  {movements.map((m) => (
                    <tr key={m.id} data-testid={`movement-row-${m.id}`} className="transition-colors hover:bg-royal-faint/20">
                      <td className="whitespace-nowrap px-4 py-3 text-royal-dim">{fmtDate(m.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-royal-cream">
                          {(() => { const Icon = MOVE_ICON[m.type as StockMovementType] ?? Scale; return <Icon className="h-3 w-3 text-royal-dim" strokeWidth={2} />; })()}
                          {STOCK_MOVEMENT_LABEL[m.type] ?? m.type}
                        </span>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${m.deltaMilli >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {m.deltaMilli >= 0 ? "+" : "−"}{formatQty(Math.abs(m.deltaMilli))} {item?.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-royal-cream">
                        {formatQty(m.balanceAfterMilli)} {item?.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-royal-dim">
                        {m.totalCostKobo !== null ? formatNaira(m.totalCostKobo) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-royal-dim">{m.staffName ?? "—"}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-royal-dim" title={m.note ?? ""}>{m.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-royal-dim">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="movement-prev"
                  className="flex items-center gap-1 rounded-full border border-royal-line px-4 py-2 transition-colors hover:text-royal-cream disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /> Newer
                </button>
                <span data-testid="movement-page">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="movement-next"
                  className="flex items-center gap-1 rounded-full border border-royal-line px-4 py-2 transition-colors hover:text-royal-cream disabled:opacity-40"
                >
                  Older <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "plain",
  testid,
}: {
  label: string;
  value: string;
  tone?: "plain" | "good" | "warn" | "bad";
  testid: string;
}) {
  const color =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-rose-400"
          : "text-royal-cream";
  return (
    <div className="border border-royal-line bg-royal-panel px-4 py-3.5" data-testid={testid}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-royal-dim">{label}</p>
      <p className={`mt-1.5 truncate font-display text-xl ${color}`}>{value}</p>
    </div>
  );
}
