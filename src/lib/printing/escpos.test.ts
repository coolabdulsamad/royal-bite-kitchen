import { describe, expect, it } from "vitest";
import {
  kitchenTicketToEscPos,
  receiptToEscPos,
  testTicketEscPos,
  type KitchenTicketData,
  type ReceiptData,
} from "./escpos";

const SALE: ReceiptData = {
  receiptNo: "RB-000042",
  cashierName: "Demo Cashier",
  soldAt: "2026-11-26T03:09:00.000Z",
  lines: [
    {
      itemName: "Jollof Rice",
      quantity: 2,
      modifiers: [
        { group: "Portion", option: "Large", priceDeltaKobo: 70000 },
        { group: "Extras", option: "Fried plantain", priceDeltaKobo: 100000 },
      ],
      lineTotalKobo: 840000,
    },
    {
      itemName: "Peppered Chicken",
      quantity: 1,
      modifiers: [],
      lineTotalKobo: 400000,
    },
  ],
  subtotalKobo: 1240000,
  discountKobo: 62000,
  totalKobo: 1178000,
  payments: [
    { method: "cash", amountKobo: 1000000, reference: null },
    { method: "bank_pos", amountKobo: 178000, reference: "TERM-01" },
  ],
  changeKobo: 0,
};

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Split decoded output into printable text lines (command bytes stripped). */
function textLines(bytes: Uint8Array): string[] {
  const raw = decode(bytes);
  // strip ESC/GS command sequences so only printable text remains
  const cleaned = raw
    .replace(/\x1b@/g, "") // ESC @ init
    .replace(/\x1ba[\x00-\x02]/g, "") // ESC a n alignment
    .replace(/\x1bE[\x00\x01]/g, "") // ESC E n bold
    .replace(/\x1d![\x00-\xff]/g, "") // GS ! n char size (exactly 1 param)
    .replace(/\x1dV\x42\x00/g, ""); // GS V partial cut
  return cleaned.split("\n").filter((l) => l.trim().length > 0);
}

describe("receiptToEscPos", () => {
  it("starts with the init command and ends with a cut", () => {
    const bytes = receiptToEscPos(SALE);
    expect(bytes[0]).toBe(0x1b); // ESC
    expect(bytes[1]).toBe(0x40); // @  — initialize
    const tail = Array.from(bytes.slice(-4));
    expect(tail).toEqual([0x1d, 0x56, 0x42, 0x00]); // GS V partial cut
  });

  it("omits the cut command when cut is false", () => {
    const bytes = receiptToEscPos(SALE, { cut: false });
    const tail = Array.from(bytes.slice(-4));
    expect(tail).not.toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it("contains store name, receipt number and cashier", () => {
    const text = decode(receiptToEscPos(SALE));
    expect(text).toContain("ROYAL BITE KITCHEN");
    expect(text).toContain("Receipt RB-000042");
    expect(text).toContain("Served by Demo Cashier");
    expect(text).toContain("Thank you for dining with us");
  });

  it("prints items, modifiers and totals with naira formatting", () => {
    const text = decode(receiptToEscPos(SALE));
    expect(text).toContain("2x Jollof Rice");
    expect(text).toContain("₦8,400");
    expect(text).toContain("Portion: Large (+₦700)");
    expect(text).toContain("1x Peppered Chicken");
    expect(text).toContain("Subtotal");
    expect(text).toContain("₦12,400");
    expect(text).toContain("Discount");
    expect(text).toContain("-₦620");
    expect(text).toContain("TOTAL");
    expect(text).toContain("₦11,780");
  });

  it("prints each split payment with its reference", () => {
    const text = decode(receiptToEscPos(SALE));
    expect(text).toContain("Cash");
    expect(text).toContain("₦10,000");
    expect(text).toContain("Bank POS (TERM-01)");
    expect(text).toContain("₦1,780");
  });

  it("shows change when there is any", () => {
    const withChange: ReceiptData = {
      ...SALE,
      payments: [{ method: "cash", amountKobo: 1200000, reference: null }],
      changeKobo: 22000,
    };
    const text = decode(receiptToEscPos(withChange));
    expect(text).toContain("Change");
    expect(text).toContain("₦220");
  });

  it("keeps every text line within the 48-column width", () => {
    for (const line of textLines(receiptToEscPos(SALE, { width: 48 }))) {
      // double-width header chars occupy 2 columns each
      expect(line.length).toBeLessThanOrEqual(48);
    }
  });

  it("keeps every text line within the 32-column width (58mm paper)", () => {
    for (const line of textLines(receiptToEscPos(SALE, { width: 32 }))) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("wraps long item names instead of overflowing", () => {
    const longSale: ReceiptData = {
      ...SALE,
      lines: [
        {
          itemName: "Special Royal Deluxe Jollof Rice With Extra Grilled Chicken",
          quantity: 1,
          modifiers: [],
          lineTotalKobo: 550000,
        },
      ],
      subtotalKobo: 550000,
      discountKobo: 0,
      totalKobo: 550000,
      payments: [{ method: "cash", amountKobo: 550000, reference: null }],
      changeKobo: 0,
    };
    const lines = textLines(receiptToEscPos(longSale, { width: 32 }));
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(32);
    expect(lines.some((l) => l.includes("₦5,500"))).toBe(true);
  });

  it("right-aligns amounts on the total row", () => {
    const lines = textLines(receiptToEscPos(SALE, { width: 48 }));
    const totalRow = lines.find((l) => l.includes("TOTAL"));
    expect(totalRow).toBeDefined();
    expect(totalRow!.endsWith("₦11,780")).toBe(true);
  });

  it("asciiMoney replaces the naira sign with NGN", () => {
    const text = decode(receiptToEscPos(SALE, { asciiMoney: true }));
    expect(text).not.toContain("₦");
    expect(text).toContain("NGN 11,780");
  });
});

describe("testTicketEscPos", () => {
  it("builds a valid test ticket", () => {
    const bytes = testTicketEscPos({ width: 32 });
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    const text = decode(bytes);
    expect(text).toContain("Printer test");
    expect(text).toContain("the printer is ready.");
    for (const line of textLines(bytes)) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });
});

describe("kitchenTicketToEscPos", () => {
  const TICKET: KitchenTicketData = {
    orderNo: "ORD-000007",
    label: "Table 4",
    notes: "No pepper at all please",
    staffName: "Demo Cashier",
    placedAt: "2026-11-26T03:09:00.000Z",
    lines: [
      {
        itemName: "Jollof Rice",
        quantity: 2,
        modifiers: [
          { group: "Portion", option: "Large" },
          { group: "Extras", option: "Fried plantain" },
        ],
      },
      { itemName: "Peppered Chicken", quantity: 1, modifiers: [] },
    ],
  };

  it("starts with the init command and ends with a cut", () => {
    const bytes = kitchenTicketToEscPos(TICKET);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    const tail = Array.from(bytes.slice(-4));
    expect(tail).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it("shows order number, table label and staff — no prices", () => {
    const text = decode(kitchenTicketToEscPos(TICKET));
    expect(text).toContain("KITCHEN TICKET");
    expect(text).toContain("ORD-000007");
    expect(text).toContain("Table 4");
    expect(text).toContain("Taken by Demo Cashier");
    expect(text).not.toContain("₦");
    expect(text).not.toContain("NGN");
  });

  it("bolds quantities and lists modifiers without prices", () => {
    const lines = textLines(kitchenTicketToEscPos(TICKET));
    expect(lines).toContain("2x Jollof Rice");
    expect(lines).toContain("1x Peppered Chicken");
    expect(lines.some((l) => l.includes("Portion: Large"))).toBe(true);
    expect(lines.some((l) => l.includes("Extras: Fried plantain"))).toBe(true);
  });

  it("prints the kitchen note, wrapped for narrow paper", () => {
    const lines = textLines(kitchenTicketToEscPos(TICKET, { width: 32 }));
    const note = lines.filter((l) => l.includes("NOTE") || l.includes("pepper"));
    expect(note.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(32);
  });

  it("omits the note section when there is none", () => {
    const text = decode(
      kitchenTicketToEscPos({ ...TICKET, notes: null }),
    );
    expect(text).not.toContain("NOTE:");
  });
});
