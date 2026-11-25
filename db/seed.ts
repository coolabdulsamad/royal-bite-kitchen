import bcrypt from "bcryptjs";
import { getDb } from "../api/queries/connection";
import { users } from "./schema";

/**
 * Initial staff accounts for Royal Bite Kitchen.
 * Safe to re-run: existing usernames are skipped.
 */
async function seed() {
  const db = getDb();
  console.log("Seeding staff accounts...");

  const accounts = [
    {
      staffCode: "RB-000",
      name: "Super Admin",
      username: "superadmin",
      secret: "Royal@2026",
      role: "superadmin" as const,
    },
    {
      staffCode: "RB-001",
      name: "Demo Manager",
      username: "manager",
      secret: "Manager@2026",
      role: "manager" as const,
    },
    {
      staffCode: "RB-101",
      name: "Demo Cashier",
      username: "cashier",
      secret: "1234",
      role: "sales" as const,
    },
  ];

  for (const account of accounts) {
    const existing = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.username, account.username),
    });
    if (existing) {
      console.log(`- ${account.username} already exists, skipped`);
      continue;
    }
    await db.insert(users).values({
      staffCode: account.staffCode,
      name: account.name,
      username: account.username,
      secretHash: bcrypt.hashSync(account.secret, 10),
      role: account.role,
    });
    console.log(`+ ${account.username} (${account.role}) created`);
  }

  console.log("Done.");
  process.exit(0);
}

seed();
