import { trpc } from "@/providers/trpc";

export default function Home() {
  const ping = trpc.ping.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: 1,
  });

  const status = ping.isLoading
    ? "checking"
    : ping.isError
      ? "offline"
      : "online";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#150A26] px-6 py-16 text-[#F2EFFA]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-[#9333EA]/20 blur-3xl" />
        <div className="absolute -bottom-48 -right-24 h-80 w-80 rounded-full bg-[#C084FC]/10 blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-2xl flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#C084FC]">
          Royal Bite Kitchen
        </p>
        <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
          Restaurant POS &amp; Management Platform
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#9C93B8]">
          Phase 1 foundation is live. Menu, sales, split payments, printing,
          offline mode and reports are being built on top of this base.
        </p>

        <div className="mt-10 w-full max-w-md border border-[#46306B] bg-[#26134A]/60 p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#D9DCE6]">
              Backend API
            </span>
            <span className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === "online"
                    ? "bg-emerald-400"
                    : status === "checking"
                      ? "bg-amber-400"
                      : "bg-rose-500"
                }`}
              />
              {status === "online"
                ? "Online"
                : status === "checking"
                  ? "Checking…"
                  : "Offline"}
            </span>
          </div>

          {status === "online" && ping.data && (
            <dl className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-[#9C93B8]">Service</dt>
                <dd>royal-bite-kitchen-api</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#9C93B8]">Database</dt>
                <dd>MySQL (platform-managed)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#9C93B8]">Last ping</dt>
                <dd>{new Date(ping.data.ts).toLocaleTimeString()}</dd>
              </div>
            </dl>
          )}

          {status === "offline" && (
            <p className="mt-4 text-xs text-rose-400">
              The API is not responding yet. If this is the first deploy, give
              it a moment to wake up.
            </p>
          )}
        </div>

        <p className="mt-10 text-[11px] tracking-wide text-[#3B2560]">
          v0.1.0 — Phase 1, Step 1: full-stack scaffold with database
        </p>
      </div>
    </main>
  );
}
