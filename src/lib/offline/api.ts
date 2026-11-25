import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../api/router";

/**
 * Vanilla tRPC client for imperative calls outside React (offline outbox
 * sync, menu cache refresh). Auth is injected by the global fetch patch
 * in src/lib/apiAuth.ts.
 */
export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});
