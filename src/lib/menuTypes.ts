import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type FullMenu = RouterOutputs["menu"]["fullMenu"];
export type MenuCategory = FullMenu[number];
export type MenuItemWithGroups = MenuCategory["items"][number];
export type ModifierLibrary = RouterOutputs["menu"]["modifierLibrary"];
export type ModifierGroupWithOptions = ModifierLibrary[number];
