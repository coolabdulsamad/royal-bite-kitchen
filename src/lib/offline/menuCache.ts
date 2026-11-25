import { useEffect, useState } from "react";
import { api } from "./api";
import type { FullMenu } from "@/lib/menuTypes";
import { readMenuCache, writeMenuCache } from "./db";
import { isOnline } from "./connectivity";

export interface MenuState {
  data: FullMenu | null;
  loading: boolean;
  /** True when showing data saved earlier on this device. */
  fromCache: boolean;
  error: string | null;
}

/**
 * POS menu: fetches menu.fullMenu while online and caches it in IndexedDB;
 * offline (or on fetch failure) serves the cached copy.
 */
export function useFullMenuWithCache(): MenuState {
  const [state, setState] = useState<MenuState>({ data: null, loading: true, fromCache: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isOnline()) {
        try {
          const data = (await api.menu.fullMenu.query()) as FullMenu;
          await writeMenuCache(data);
          if (!cancelled) setState({ data, loading: false, fromCache: false, error: null });
          return;
        } catch {
          // Fall through to the cached copy.
        }
      }
      const cached = await readMenuCache();
      if (cancelled) return;
      if (cached) {
        setState({ data: cached as FullMenu, loading: false, fromCache: true, error: null });
      } else {
        setState({
          data: null,
          loading: false,
          fromCache: false,
          error: "You're offline and no menu is saved on this device yet. Connect once to download it.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
