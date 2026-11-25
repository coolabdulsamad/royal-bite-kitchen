import {
  boolean,
  mysqlEnum,
  mysqlTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { STAFF_ROLES } from "../contracts/roles";

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
