export interface CartModifier {
  group: string;
  option: string;
  optionId: number;
  priceDeltaKobo: number;
}

export interface CartLine {
  /** itemId + sorted option ids — identical picks merge into one line */
  key: string;
  itemId: number;
  name: string;
  /** Base item price before modifiers (kobo) */
  unitPriceKobo: number;
  modifiers: CartModifier[];
  quantity: number;
}

export function lineUnitKobo(line: CartLine): number {
  return (
    line.unitPriceKobo +
    line.modifiers.reduce((sum, m) => sum + m.priceDeltaKobo, 0)
  );
}

export function lineTotalKobo(line: CartLine): number {
  return lineUnitKobo(line) * line.quantity;
}

export function cartSubtotalKobo(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotalKobo(l), 0);
}

export function makeCartKey(itemId: number, optionIds: number[]): string {
  return `${itemId}:${[...optionIds].sort((a, b) => a - b).join(",")}`;
}

export interface Discount {
  type: "percent" | "fixed";
  /** percent: 0–100 · fixed: NAIRA amount */
  value: number;
}

export function discountKoboFor(
  discount: Discount | null,
  subtotalKobo: number,
): number {
  if (!discount || discount.value <= 0 || subtotalKobo <= 0) return 0;
  const kobo =
    discount.type === "percent"
      ? Math.round((subtotalKobo * Math.min(discount.value, 100)) / 100)
      : Math.round(discount.value * 100);
  return Math.min(kobo, subtotalKobo);
}
