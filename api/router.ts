import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { menuRouter } from "./routers/menu";
import { ordersRouter } from "./routers/orders";
import { salesRouter } from "./routers/sales";
import { staffRouter } from "./routers/staff";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  staff: staffRouter,
  menu: menuRouter,
  orders: ordersRouter,
  sales: salesRouter,
});

export type AppRouter = typeof appRouter;
