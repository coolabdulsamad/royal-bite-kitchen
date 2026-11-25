import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { staffRouter } from "./routers/staff";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  staff: staffRouter,
});

export type AppRouter = typeof appRouter;
