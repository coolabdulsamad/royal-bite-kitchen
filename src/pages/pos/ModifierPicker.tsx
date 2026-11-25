import { useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { formatNaira } from "@contracts/money";
import type { MenuItemWithGroups } from "@/lib/menuTypes";
import type { CartModifier } from "@/lib/cart";

export function ModifierPicker({
  item,
  onCancel,
  onAdd,
}: {
  item: MenuItemWithGroups;
  onCancel: () => void;
  onAdd: (modifiers: CartModifier[], quantity: number) => void;
}) {
  // groupId -> selected option ids
  const [selections, setSelections] = useState<Map<number, Set<number>>>(
    () => new Map(),
  );
  const [quantity, setQuantity] = useState(1);

  const selectedKobo = useMemo(() => {
    let extra = 0;
    for (const g of item.modifierGroups) {
      const chosen = selections.get(g.id);
      if (!chosen) continue;
      for (const opt of g.options) {
        if (chosen.has(opt.id)) extra += opt.priceDeltaKobo;
      }
    }
    return item.priceKobo + extra;
  }, [item, selections]);

  const missingRequired = useMemo(
    () =>
      item.modifierGroups.filter(
        (g) => g.required && !(selections.get(g.id)?.size),
      ),
    [item, selections],
  );

  function toggle(groupId: number, optionId: number, single: boolean) {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(groupId) ?? []);
      if (single) {
        if (set.has(optionId) && set.size === 1) {
          set.delete(optionId); // allow un-picking an optional single
        } else {
          set.clear();
          set.add(optionId);
        }
      } else {
        if (set.has(optionId)) set.delete(optionId);
        else set.add(optionId);
      }
      if (set.size === 0) next.delete(groupId);
      else next.set(groupId, set);
      return next;
    });
  }

  function handleAdd() {
    const modifiers: CartModifier[] = [];
    for (const g of item.modifierGroups) {
      const chosen = selections.get(g.id);
      if (!chosen) continue;
      for (const opt of g.options) {
        if (chosen.has(opt.id)) {
          modifiers.push({
            group: g.name,
            option: opt.name,
            optionId: opt.id,
            priceDeltaKobo: opt.priceDeltaKobo,
          });
        }
      }
    }
    onAdd(modifiers, quantity);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="royal-scroll relative flex max-h-[88vh] w-full max-w-md flex-col border border-royal-line bg-royal-bgsoft">
        <div className="flex items-start justify-between border-b border-royal-line px-6 py-5">
          <div>
            <h3 className="font-display text-2xl text-royal-cream">{item.name}</h3>
            <p className="mt-1 text-sm text-royal-dim">
              {formatNaira(item.priceKobo)}
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

        <div className="flex-1 overflow-y-auto px-6 py-5 royal-scroll">
          {item.modifierGroups.map((g) => (
            <div key={g.id} className="mb-6 last:mb-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
                {g.name}
                <span className="ml-2 normal-case tracking-normal text-royal-dim/60">
                  {g.required
                    ? g.selectionType === "single"
                      ? "required · pick one"
                      : "required · pick many"
                    : g.selectionType === "single"
                      ? "optional · pick one"
                      : "optional · pick many"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {g.options
                  .filter((o) => o.active)
                  .map((opt) => {
                    const active = selections.get(g.id)?.has(opt.id) ?? false;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggle(g.id, opt.id, g.selectionType === "single")}
                        className={`min-h-11 border px-4 py-2.5 text-sm transition-colors ${
                          active
                            ? "border-royal-accent bg-royal-faint/50 text-royal-cream"
                            : "border-royal-line text-royal-dim hover:border-royal-accent/60 hover:text-royal-cream"
                        }`}
                      >
                        {opt.name}
                        {opt.priceDeltaKobo > 0 && (
                          <span className={active ? " text-royal-accent" : " text-royal-dim/60"}>
                            {" "}+{formatNaira(opt.priceDeltaKobo)}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-royal-line px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center border border-royal-line text-royal-cream transition-colors hover:border-royal-accent"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <span className="w-8 text-center text-lg text-royal-cream">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="flex h-10 w-10 items-center justify-center border border-royal-line text-royal-cream transition-colors hover:border-royal-accent"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <p className="font-display text-2xl text-royal-cream">
              {formatNaira(selectedKobo * quantity)}
            </p>
          </div>
          <button
            type="button"
            disabled={missingRequired.length > 0}
            onClick={handleAdd}
            className="mt-5 h-13 w-full rounded-full border border-royal-accent py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {missingRequired.length > 0
              ? `Choose ${missingRequired[0].name} first`
              : "Add to sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
