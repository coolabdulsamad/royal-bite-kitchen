import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { STAFF_ROLES } from "../contracts/roles";

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  staffCode: varchar("staff_code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  username: varchar("username", { length: 60 }).notNull().unique(),
  secretHash: varchar("secret_hash", { length: 120 }).notNull(),
  role: mysqlEnum("role", STAFF_ROLES).notNull().default("sales"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type User = typeof users.$inferSelect;

// ---------------------------------------------------------------------------
// Menu
// Money is stored as integer KOBO (₦1 = 100 kobo) so totals are always exact.
// ---------------------------------------------------------------------------

export const categories = mysqlTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const menuItems = mysqlTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: bigint("category_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => categories.id),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 500 }),
  priceKobo: int("price_kobo").notNull(),
  available: boolean("available").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const modifierGroups = mysqlTable("modifier_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  selectionType: mysqlEnum("selection_type", ["single", "multi"])
    .notNull()
    .default("single"),
  required: boolean("required").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const modifierOptions = mysqlTable("modifier_options", {
  id: serial("id").primaryKey(),
  groupId: bigint("group_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => modifierGroups.id),
  name: varchar("name", { length: 80 }).notNull(),
  priceDeltaKobo: int("price_delta_kobo").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const itemModifierGroups = mysqlTable("item_modifier_groups", {
  id: serial("id").primaryKey(),
  itemId: bigint("item_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => menuItems.id),
  groupId: bigint("group_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => modifierGroups.id),
  sortOrder: int("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Relations (powers the db.query.* relational API)
// ---------------------------------------------------------------------------

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  modifierLinks: many(itemModifierGroups),
}));

export const modifierGroupsRelations = relations(
  modifierGroups,
  ({ many }) => ({
    options: many(modifierOptions),
    itemLinks: many(itemModifierGroups),
  }),
);

export const modifierOptionsRelations = relations(
  modifierOptions,
  ({ one }) => ({
    group: one(modifierGroups, {
      fields: [modifierOptions.groupId],
      references: [modifierGroups.id],
    }),
  }),
);

export const itemModifierGroupsRelations = relations(
  itemModifierGroups,
  ({ one }) => ({
    item: one(menuItems, {
      fields: [itemModifierGroups.itemId],
      references: [menuItems.id],
    }),
    group: one(modifierGroups, {
      fields: [itemModifierGroups.groupId],
      references: [modifierGroups.id],
    }),
  }),
);

export type Category = typeof categories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type ModifierGroup = typeof modifierGroups.$inferSelect;
export type ModifierOption = typeof modifierOptions.$inferSelect;

// ---------------------------------------------------------------------------
// Sales — line prices/modifiers are SNAPSHOTS: editing the menu later never
// rewrites history. Money stays in integer kobo.
// ---------------------------------------------------------------------------

export const sales = mysqlTable("sales", {
  id: serial("id").primaryKey(),
  receiptNo: varchar("receipt_no", { length: 20 }).notNull().unique(),
  staffId: bigint("staff_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  subtotalKobo: int("subtotal_kobo").notNull(),
  discountKobo: int("discount_kobo").notNull().default(0),
  totalKobo: int("total_kobo").notNull(),
  status: mysqlEnum("status", ["completed", "held", "returned"])
    .notNull()
    .default("completed"),
  /**
   * Idempotency key from the selling device (offline outbox). A retried sync
   * carries the same ref, so the server returns the existing sale instead of
   * recording a duplicate.
   */
  clientRef: varchar("client_ref", { length: 64 }).unique(),
  /** Business date of the sale — usually now, but manager+ can backdate. */
  soldAt: timestamp("sold_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleItems = mysqlTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: bigint("sale_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => sales.id),
  /** Kept for analytics; nullable so deleting a menu item keeps history. */
  itemId: bigint("item_id", { mode: "number", unsigned: true }).references(
    () => menuItems.id,
  ),
  itemName: varchar("item_name", { length: 120 }).notNull(),
  unitPriceKobo: int("unit_price_kobo").notNull(),
  /** JSON snapshot: [{group, option, priceDeltaKobo}] */
  modifiersJson: varchar("modifiers_json", { length: 2000 }),
  quantity: int("quantity").notNull(),
  lineTotalKobo: int("line_total_kobo").notNull(),
});

export const salePayments = mysqlTable("sale_payments", {
  id: serial("id").primaryKey(),
  saleId: bigint("sale_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => sales.id),
  method: mysqlEnum("method", ["cash", "bank_pos", "transfer"]).notNull(),
  amountKobo: int("amount_kobo").notNull(),
  reference: varchar("reference", { length: 120 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const salesRelations = relations(sales, ({ one, many }) => ({
  staff: one(users, { fields: [sales.staffId], references: [users.id] }),
  items: many(saleItems),
  payments: many(salePayments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  item: one(menuItems, {
    fields: [saleItems.itemId],
    references: [menuItems.id],
  }),
}));

export const salePaymentsRelations = relations(salePayments, ({ one }) => ({
  sale: one(sales, { fields: [salePayments.saleId], references: [sales.id] }),
}));

export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type SalePayment = typeof salePayments.$inferSelect;
