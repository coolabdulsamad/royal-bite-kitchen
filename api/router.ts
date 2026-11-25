import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { menuRouter } from "./routers/menu";
import { staffRouter } from "./routers/staff";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  staff: staffRouter,
  menu: menuRouter,
});

export type AppRouter = typeof appRouter;
