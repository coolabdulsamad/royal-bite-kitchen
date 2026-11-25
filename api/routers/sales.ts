import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";
import { createRouter } from "../middleware";
import { authedProcedure } from "../auth/guards";
import { getDb } from "../queries/connection";
import {
  itemModifierGroups,
  menuItems,
  modifierGroups,
  modifierOptions,
  saleItems,
  salePayments,
  sales,
} from "@db/schema";
import { nairaToKobo } from "@contracts/money";
import { DISCOUNT_LIMIT_PERCENT } from "@contracts/payments";
import { ROLE_LEVEL } from "@contracts/roles";
import type { StaffRole } from "@contracts/roles";

interface ModifierSnapshot {
  group: string;
  option: string;
  priceDeltaKobo: number;
}

export const salesRouter = createRouter({
  completeSale: authedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              itemId: z.number().int().positive(),
              quantity: z.number().int().min(1).max(99),
              optionIds: z.array(z.number().int().positive()).max(20).default([]),
            }),
          )
          .min(1)
          .max(100),
        discount: z
          .object({
            type: z.enum(["percent", "fixed"]),
            /** percent: 0–100 · fixed: amount in NAIRA */
            value: z.number().min(0),
          })
          .nullish(),
        payments: z
          .array(
            z.object({
              method: z.enum(["cash", "bank_pos", "transfer"]),
              /** Amount in NAIRA */
              amount: z.number().positive().max(100_000_000),
              reference: z.string().trim().max(120).optional(),
            }),
          )
          .max(6)
          .default([]),
        /** ISO datetime — manager+ only, cannot be in the future. */
        saleDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const staffRole = ctx.staff.role as StaffRole;

      // ---------------------------------------------------------- load menu
      const itemIds = input.items.map((i) => i.itemId);
      const dbItems = await db
        .select()
        .from(menuItems)
        .where(inArray(menuItems.id, itemIds));
      const links = await db
        .select()
        .from(itemModifierGroups)
        .where(inArray(itemModifierGroups.itemId, itemIds));
      const allOptionIds = input.items.flatMap((i) => i.optionIds);
      const dbOptions =
        allOptionIds.length > 0
          ? await db
              .select()
              .from(modifierOptions)
              .where(inArray(modifierOptions.id, allOptionIds))
          : [];
      const groupIds = Array.from(new Set(links.map((l) => l.groupId)));
      const dbGroups =
        groupIds.length > 0
          ? await db
              .select()
              .from(modifierGroups)
              .where(inArray(modifierGroups.id, groupIds))
          : [];

      // --------------------------------------------------- price the basket
      let subtotalKobo = 0;
      const pricedLines: Array<{
        itemId: number;
        itemName: string;
        unitPriceKobo: number;
        quantity: number;
        modifiers: ModifierSnapshot[];
        lineTotalKobo: number;
      }> = [];

      for (const cartLine of input.items) {
        const item = dbItems.find((i) => i.id === cartLine.itemId);
        if (!item) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One of the items no longer exists — refresh the menu",
          });
        }
        if (!item.available) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `“${item.name}” is currently unavailable`,
          });
        }

        const itemGroupIds = links
          .filter((l) => l.itemId === item.id)
          .map((l) => l.groupId);
        const chosenOptions = dbOptions.filter((o) =>
          cartLine.optionIds.includes(o.id),
        );

        // Every chosen option must belong to a group attached to this item.
        for (const opt of chosenOptions) {
          if (!itemGroupIds.includes(opt.groupId) || !opt.active) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid modifier on “${item.name}”`,
            });
          }
        }
        // Single-select groups: at most one option.
        const byGroup = new Map<number, number>();
        for (const opt of chosenOptions) {
          byGroup.set(opt.groupId, (byGroup.get(opt.groupId) ?? 0) + 1);
        }
        for (const [gid, count] of byGroup) {
          const group = dbGroups.find((g) => g.id === gid);
          if (group?.selectionType === "single" && count > 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `“${group.name}” allows only one choice on “${item.name}”`,
            });
          }
        }
        // Required groups must be satisfied.
        for (const gid of itemGroupIds) {
          const group = dbGroups.find((g) => g.id === gid);
          if (group?.required && !byGroup.has(gid)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `“${item.name}” needs a choice for “${group.name}”`,
            });
          }
        }

        const modifiers: ModifierSnapshot[] = chosenOptions.map((o) => ({
          group: dbGroups.find((g) => g.id === o.groupId)?.name ?? "",
          option: o.name,
          priceDeltaKobo: o.priceDeltaKobo,
        }));
        const unitKobo =
          item.priceKobo + chosenOptions.reduce((s, o) => s + o.priceDeltaKobo, 0);
        const lineTotalKobo = unitKobo * cartLine.quantity;
        subtotalKobo += lineTotalKobo;

        pricedLines.push({
          itemId: item.id,
          itemName: item.name,
          unitPriceKobo: item.priceKobo,
          quantity: cartLine.quantity,
          modifiers,
          lineTotalKobo,
        });
      }

      // ------------------------------------------------------------ discount
      let discountKobo = 0;
      if (input.discount && input.discount.value > 0) {
        const limit = DISCOUNT_LIMIT_PERCENT[staffRole];
        if (input.discount.type === "percent") {
          if (input.discount.value > limit) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Your role can give at most ${limit}% discount`,
            });
          }
          discountKobo = Math.round((subtotalKobo * input.discount.value) / 100);
        } else {
          discountKobo = nairaToKobo(input.discount.value);
          const asPercent =
            subtotalKobo > 0 ? (discountKobo / subtotalKobo) * 100 : 100;
          if (asPercent > limit) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `That fixed discount is above your ${limit}% limit`,
            });
          }
        }
        if (discountKobo > subtotalKobo) discountKobo = subtotalKobo;
      }
      const totalKobo = subtotalKobo - discountKobo;

      // ------------------------------------------------------------ payments
      const payments = input.payments.map((p) => ({
        ...p,
        amountKobo: nairaToKobo(p.amount),
      }));
      if (totalKobo > 0 && payments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one payment",
        });
      }
      const nonCashKobo = payments
        .filter((p) => p.method !== "cash")
        .reduce((s, p) => s + p.amountKobo, 0);
      if (nonCashKobo > totalKobo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Card/transfer payments cannot exceed the total",
        });
      }
      const paidKobo = payments.reduce((s, p) => s + p.amountKobo, 0);
      if (paidKobo < totalKobo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payments do not cover the total",
        });
      }
      const changeKobo = paidKobo - totalKobo;

      // --------------------------------------------------------- sale date
      let soldAt = new Date();
      if (input.saleDate) {
        if (ROLE_LEVEL[staffRole] < ROLE_LEVEL.manager) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only a manager or above can backdate a sale",
          });
        }
        const parsed = new Date(input.saleDate);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sale date cannot be in the future",
          });
        }
        soldAt = parsed;
      }

      // ------------------------------------------------------------- persist
      try {
        const result = await db.transaction(async (tx) => {
          const [saleRow] = await tx
            .insert(sales)
            .values({
              receiptNo: "PENDING",
              staffId: ctx.staff.sub,
              subtotalKobo,
              discountKobo,
              totalKobo,
              soldAt,
            })
            .$returningId();
          const receiptNo = `RB-${String(saleRow.id).padStart(6, "0")}`;
          await tx
            .update(sales)
            .set({ receiptNo })
            .where(inArray(sales.id, [saleRow.id]));

          for (const line of pricedLines) {
            await tx.insert(saleItems).values({
              saleId: saleRow.id,
              itemId: line.itemId,
              itemName: line.itemName,
              unitPriceKobo: line.unitPriceKobo,
              modifiersJson:
                line.modifiers.length > 0 ? JSON.stringify(line.modifiers) : null,
              quantity: line.quantity,
              lineTotalKobo: line.lineTotalKobo,
            });
          }
          for (const p of payments) {
            await tx.insert(salePayments).values({
              saleId: saleRow.id,
              method: p.method,
              amountKobo: p.amountKobo,
              reference: p.reference || null,
            });
          }
          return { saleId: saleRow.id, receiptNo };
        });

        return {
          ok: true as const,
          saleId: result.saleId,
          receiptNo: result.receiptNo,
          cashierName: ctx.staff.name,
          soldAt: soldAt.toISOString(),
          lines: pricedLines,
          subtotalKobo,
          discountKobo,
          totalKobo,
          payments: payments.map((p) => ({
            method: p.method,
            amountKobo: p.amountKobo,
            reference: p.reference ?? null,
          })),
          changeKobo,
        };
      } catch (err) {
        // Unique receipt race or DB failure — surface as a retryable error.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Could not save the sale — nothing was charged. Please try again.",
          cause: err,
        });
      }
    }),
});
