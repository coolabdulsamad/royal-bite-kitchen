import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { attendanceRouter } from "./routers/attendance";
import { customersRouter } from "./routers/customers";
import { menuRouter } from "./routers/menu";
import { ordersRouter } from "./routers/orders";
import { partnersRouter } from "./routers/partners";
import { salesRouter } from "./routers/sales";
import { staffRouter } from "./routers/staff";
import { stockRouter } from "./routers/stock";
import { terminalsRouter } from "./routers/terminals";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  attendance: attendanceRouter,
  staff: staffRouter,
  menu: menuRouter,
  orders: ordersRouter,
  partners: partnersRouter,
  sales: salesRouter,
  terminals: terminalsRouter,
  customers: customersRouter,
  stock: stockRouter,
});

export type AppRouter = typeof appRouter;
