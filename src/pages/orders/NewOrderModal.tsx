import { useMemo, useState } from "react";
import { CloudOff, Minus, Plus, Search, Send, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { useFullMenuWithCache, useOnlineStatus } from "@/lib/offline";
import { printerManager } from "@/lib/printing/printer";
import { formatNaira } from "@contracts/money";
import {
  cartSubtotalKobo,
  lineTotalKobo,
  lineUnitKobo,
  makeCartKey,
  type CartLine,
  type CartModifier,
} from "@/lib/cart";
import type { MenuItemWithGroups } from "@/lib/menuTypes";
import { ModifierPicker } from "../pos/ModifierPicker";

/**
 * Waiter order entry — builds a kitchen ticket from the live menu.
 * Online-only: an unsent order isn't money yet (offline sales still work
 * from the POS), so there's no offline queue here.
 */
export function NewOrderModal({
  autoPrintTicket,
  onClose,
  onCreated,
}: {
  autoPrintTicket: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const menu = useFullMenuWithCache();
  const online = useOnlineStatus();

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<MenuItemWithGroups | null>(null);

  const create = trpc.orders.create.useMutation({
    onSuccess: (order) => {
      if (autoPrintTicket) {
        // fire-and-forget — the board's per-ticket button is the retry path
        printerManager
          .printKitchenTicket({
            orderNo: order.orderNo,
            label: order.label,
            notes: order.notes,
            staffName: order.staffName,
            placedAt: order.createdAt,
            lines: order.lines.map((l) => ({
              itemName: l.itemName,
              quantity: l.quantity,
              modifiers: l.modifiers.map((m) => ({
                group: m.group,
                option: m.option,
              })),
            })),
          })
          .catch(() => {});
      }
      onCreated();
    },
  });

  const categories = menu.data ?? [];
  const visibleCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories
      .filter((c) => (activeCategory === null ? true : c.id === activeCategory))
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) => i.available && (term === "" || i.name.toLowerCase().includes(term)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, activeCategory, search]);

  const totalKobo = cartSubtotalKobo(lines);

  function addLine(item: MenuItemWithGroups, modifiers: CartModifier[], quantity: number) {
    const key = makeCartKey(item.id, modifiers.map((m) => m.optionId));
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
        );
      }
      return [
        ...prev,
        {
          key,
          itemId: item.id,
          name: item.name,
          unitPriceKobo: item.priceKobo,
          modifiers,
          quantity,
        },
      ];
    });
  }

  function tapItem(item: MenuItemWithGroups) {
    if (item.modifierGroups.length > 0) setPicking(item);
    else addLine(item, [], 1);
  }

  function setQuantity(key: string, quantity: number) {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, quantity) } : l)),
    );
  }

  const canSend =
    online && label.trim().length > 0 && lines.length > 0 && !create.isPending;

  function submit() {
    if (!canSend) return;
    create.mutate({
      label: label.trim(),
      notes: notes.trim() || undefined,
      items: lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        optionIds: l.modifiers.map((m) => m.optionId),
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-5xl flex-col border border-royal-line bg-royal-bg sm:h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-royal-line px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              New order
            </p>
            <p className="mt-0.5 text-xs text-royal-dim">
              Sends a ticket to the kitchen — payment happens later in the POS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-royal-dim transition-colors hover:text-royal-cream"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {!online && (
          <p className="flex items-center gap-2 border-b border-amber-400/40 bg-amber-400/10 px-5 py-2 text-xs text-amber-300">
            <CloudOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            You're offline — orders need a connection. Quick counter sales still work from New Sale.
          </p>
        )}
        {create.error && (
          <p className="border-b border-rose-400/40 bg-rose-400/10 px-5 py-2 text-xs text-rose-300">
            {create.error.message}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Menu picker */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-royal-line lg:border-b-0 lg:border-r">
            <div className="border-b border-royal-line px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-royal-dim" strokeWidth={1.75} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the menu…"
                  className="w-full border border-royal-line bg-transparent py-2 pl-10 pr-3 text-sm text-royal-cream placeholder:text-royal-dim/50 focus:border-royal-accent focus:outline-none"
                />
              </div>
              <div className="royal-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
                <Chip label="All" active={activeCategory === null} onClick={() => setActiveCategory(null)} />
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    active={activeCategory === c.id}
                    onClick={() => setActiveCategory((cur) => (cur === c.id ? null : c.id))}
                  />
                ))}
              </div>
            </div>
            <div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {menu.loading && (
                <p className="py-10 text-center text-sm text-royal-dim">Loading the menu…</p>
              )}
              {menu.error && (
                <p className="py-10 text-center text-sm text-rose-400">{menu.error}</p>
              )}
              {menu.data && visibleCategories.length === 0 && (
                <p className="py-10 text-center text-sm text-royal-dim">
                  Nothing matches — try another search.
                </p>
              )}
              {visibleCategories.map((c) => (
                <section key={c.id} className="mb-5 last:mb-0">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
                    {c.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {c.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => tapItem(item)}
                        className="min-h-16 border border-royal-line bg-royal-surface/60 p-3 text-left transition-colors hover:border-royal-accent/70 hover:bg-royal-faint/40"
                      >
                        <span className="block text-xs leading-snug text-royal-cream">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-royal-accent">
                          {formatNaira(item.priceKobo)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="flex min-h-0 w-full flex-col lg:w-[360px] lg:shrink-0">
            <div className="space-y-3 border-b border-royal-line px-5 py-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
                  Table / customer
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Table 4, Musa, Takeaway 2"
                  maxLength={64}
                  autoFocus
                  className="mt-1 w-full border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream placeholder:text-royal-dim/50 focus:border-royal-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
                  Kitchen note (optional)
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. no pepper, allergies, extra spicy"
                  maxLength={500}
                  className="mt-1 w-full border-b border-royal-line bg-transparent py-2 text-sm text-royal-cream placeholder:text-royal-dim/50 focus:border-royal-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 ? (
                <p className="py-10 text-center text-sm text-royal-dim">
                  Tap menu items to build the order.
                </p>
              ) : (
                <ul className="space-y-4">
                  {lines.map((line) => (
                    <li key={line.key} className="border-b border-royal-line/60 pb-3 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm leading-snug text-royal-cream">{line.name}</p>
                          {line.modifiers.map((m, i) => (
                            <p key={i} className="mt-0.5 text-xs text-royal-dim">
                              · {m.option}
                              {m.priceDeltaKobo > 0 && ` +${formatNaira(m.priceDeltaKobo)}`}
                            </p>
                          ))}
                          <p className="mt-1 text-xs text-royal-dim/70">
                            {formatNaira(lineUnitKobo(line))} each
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-royal-cream">
                          {formatNaira(lineTotalKobo(line))}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center border border-royal-line text-royal-cream transition-colors hover:border-royal-accent"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                        <span className="w-6 text-center text-sm text-royal-cream">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center border border-royal-line text-royal-cream transition-colors hover:border-royal-accent"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, 0)}
                          className="ml-auto p-1 text-royal-dim transition-colors hover:text-rose-400"
                          aria-label="Remove line"
                        >
                          <X className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-royal-line px-5 py-4">
              <p className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
                  Total
                </span>
                <span className="font-display text-2xl text-royal-cream">
                  {formatNaira(totalKobo)}
                </span>
              </p>
              <button
                type="button"
                disabled={!canSend}
                onClick={submit}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-royal-accent bg-royal-accent py-3 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-colors hover:bg-royal-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} />
                {create.isPending ? "Sending…" : "Send to kitchen"}
              </button>
              <p className="mt-2 text-center text-[10px] uppercase tracking-[0.15em] text-royal-dim/70">
                Taken by {user?.name ?? "staff"} · payment later via Pay
              </p>
            </div>
          </div>
        </div>

        {picking && (
          <ModifierPicker
            item={picking}
            onCancel={() => setPicking(null)}
            onAdd={(modifiers, quantity) => {
              addLine(picking, modifiers, quantity);
              setPicking(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active
          ? "border-royal-accent bg-royal-accent text-royal-bg"
          : "border-royal-line text-royal-dim hover:border-royal-accent/60 hover:text-royal-cream"
      }`}
    >
      {label}
    </button>
  );
}
