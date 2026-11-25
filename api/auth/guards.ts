import { TRPCError } from "@trpc/server";
import { publicQuery } from "../middleware";
import { verifyStaffToken, type StaffTokenPayload } from "./jwt";
import { ROLE_LEVEL, type StaffRole } from "@contracts/roles";
import type { TrpcContext } from "../context";

function extractStaff(ctx: TrpcContext): StaffTokenPayload {
  const header = ctx.req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  try {
    return verifyStaffToken(header.slice(7));
  } catch {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Session expired — sign in again",
    });
  }
}

/** Requires any signed-in staff member. Injects ctx.staff. */
export const authedProcedure = publicQuery.use(({ ctx, next }) => {
  const staff = extractStaff(ctx);
  return next({ ctx: { ...ctx, staff } });
});

/** Requires a signed-in staff member at or above minRole. Injects ctx.staff. */
export function roleProcedure(minRole: StaffRole) {
  return publicQuery.use(({ ctx, next }) => {
    const staff = extractStaff(ctx);
    if (ROLE_LEVEL[staff.role] < ROLE_LEVEL[minRole]) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your role is not allowed to do this",
      });
    }
    return next({ ctx: { ...ctx, staff } });
  });
}
