import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { ALL_NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";

function BrandBlock() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-royal-line px-5">
      <img
        src="/logo.jpeg"
        alt="Royal Bite Kitchen"
        className="h-9 w-9 rounded-sm object-cover"
      />
      <div>
        <p className="font-display text-lg leading-none tracking-wide text-royal-cream">
          ROYAL BITE
        </p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.35em] text-royal-dim">
          Kitchen · POS
        </p>
      </div>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="royal-scroll flex-1 overflow-y-auto py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim/70">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 border-l-2 px-5 py-2.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? "border-royal-accent bg-royal-faint/40 text-royal-cream"
                    : "border-transparent text-royal-dim hover:bg-royal-faint/20 hover:text-royal-cream"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{item.title}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-royal-line px-5 py-3">
      <p className="text-[10px] tracking-wide text-royal-dim/60">
        v0.2 · Phase 1 — design system &amp; shell
      </p>
    </div>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const ping = trpc.ping.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: 1,
  });
  const apiOnline = Boolean(ping.data) && !ping.isError;

  const current = ALL_NAV_ITEMS.find((item) => item.path === location.pathname);

  return (
    <div className="min-h-screen bg-royal-bg font-sans text-royal-cream">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-royal-line bg-royal-bgsoft lg:flex">
        <BrandBlock />
        <Nav />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-royal-line bg-royal-bgsoft">
            <div className="flex items-center justify-between border-b border-royal-line pr-3">
              <BrandBlock />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-royal-dim transition-colors hover:text-royal-cream"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Nav onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-royal-line bg-royal-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 text-royal-dim transition-colors hover:text-royal-cream lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl text-royal-cream">
            {current?.title ?? "Royal Bite Kitchen"}
          </h1>

          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-royal-dim">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  ping.isLoading
                    ? "bg-amber-400"
                    : apiOnline
                      ? "bg-emerald-400"
                      : "bg-rose-500"
                }`}
              />
              <span className="hidden sm:inline">
                {ping.isLoading ? "Connecting…" : apiOnline ? "API online" : "API offline"}
              </span>
            </span>
            <span className="border border-royal-line px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-royal-dim">
              Preview
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
