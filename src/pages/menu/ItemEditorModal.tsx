import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type {
  MenuCategory,
  MenuItemWithGroups,
  ModifierLibrary,
} from "@/lib/menuTypes";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

export function ItemEditorModal({
  categories,
  modifierLibrary,
  initial,
  defaultCategoryId,
  onClose,
}: {
  categories: MenuCategory[];
  modifierLibrary: ModifierLibrary;
  /** null → create mode */
  initial: MenuItemWithGroups | null;
  defaultCategoryId?: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState<number>(
    initial?.categoryId ??
      defaultCategoryId ??
      categories.find((c) => c.active)?.id ??
      0,
  );
  const [price, setPrice] = useState(
    initial ? String(initial.priceKobo / 100) : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [groupIds, setGroupIds] = useState<Set<number>>(
    () => new Set(initial?.modifierGroups.map((g) => g.id) ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const createItem = trpc.menu.createItem.useMutation();
  const updateItem = trpc.menu.updateItem.useMutation();
  const setGroups = trpc.menu.setItemModifierGroups.useMutation();

  function toggleGroup(id: number) {
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const priceNaira = Number.parseFloat(price);
    if (!Number.isFinite(priceNaira) || priceNaira < 0) {
      setError("Enter a valid price in naira (e.g. 2500).");
      return;
    }
    if (!categoryId) {
      setError("Choose a category first.");
      return;
    }
    setSaving(true);
    try {
      let itemId = initial?.id;
      if (initial) {
        await updateItem.mutateAsync({
          id: initial.id,
          name,
          description,
          price: priceNaira,
          categoryId,
        });
      } else {
        const res = await createItem.mutateAsync({
          categoryId,
          name,
          description: description || undefined,
          price: priceNaira,
        });
        itemId = res.id;
      }
      if (itemId) {
        await setGroups.mutateAsync({
          itemId,
          groupIds: Array.from(groupIds),
        });
      }
      await utils.menu.fullMenu.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="royal-scroll relative max-h-[90vh] w-full max-w-lg overflow-y-auto border border-royal-line bg-royal-bgsoft p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              {initial ? "Edit item" : "New item"}
            </p>
            <h3 className="mt-2 font-display text-2xl text-royal-cream">
              {initial ? initial.name : "Add to the menu"}
            </h3>
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

        <label className="mt-8 block">
          <span className={labelCls}>Item name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jollof Rice"
            className={inputCls}
          />
        </label>

        <div className="mt-6 grid grid-cols-2 gap-x-8">
          <label className="block">
            <span className={labelCls}>Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className={`${inputCls} bg-royal-bgsoft`}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-royal-bgsoft">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Price (₦)</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2500"
              className={inputCls}
            />
          </label>
        </div>

        <label className="mt-6 block">
          <span className={labelCls}>Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Short line shown under the name"
            className={`${inputCls} resize-none`}
          />
        </label>

        {modifierLibrary.length > 0 && (
          <div className="mt-8">
            <p className={labelCls}>Modifier groups</p>
            <p className="mt-1 text-xs text-royal-dim/70">
              Groups the cashier must pick from when selling this item.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {modifierLibrary.map((g) => {
                const active = groupIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={`border px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? "border-royal-accent bg-royal-faint/40 text-royal-cream"
                        : "border-royal-line text-royal-dim hover:border-royal-accent/60 hover:text-royal-cream"
                    }`}
                  >
                    {g.name}
                    {g.required && <span className="ml-1 text-royal-accent">*</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-6 border-l-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-full border border-royal-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? "Save changes" : "Add item"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[0.2em] text-royal-dim hover:text-royal-cream"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
