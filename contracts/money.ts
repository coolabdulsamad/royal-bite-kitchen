// Money helpers — all money in the system is stored as integer kobo
// (₦1 = 100 kobo). These helpers are the ONLY conversion points.

/** Naira (decimal) → kobo (integer). */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/** Kobo → display string, e.g. 250000 → "₦2,500" (no decimals when whole). */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  const whole = Number.isInteger(naira);
  return (
    "₦" +
    naira.toLocaleString("en-NG", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}
