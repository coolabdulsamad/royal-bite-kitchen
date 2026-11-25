import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

export default function Login() {
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Real authentication is wired in Phase 1 · Step 3.
    navigate("/pos");
  }

  return (
    <main className="grid min-h-screen bg-royal-bg font-sans text-royal-cream lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden border-b border-royal-line bg-royal-bgsoft px-8 py-14 lg:border-b-0 lg:border-r">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-royal-primary/15 blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center text-center">
          <img
            src="/logo.jpeg"
            alt="Royal Bite Kitchen logo"
            className="h-24 w-24 rounded-md object-cover shadow-2xl shadow-royal-primary/20"
          />
          <h1 className="mt-8 font-display text-4xl tracking-wide sm:text-5xl">
            ROYAL BITE
          </h1>
          <p className="mt-2 font-display text-2xl tracking-wide text-royal-accent">
            KITCHEN
          </p>
          <div className="mt-6 h-px w-16 bg-royal-line" />
          <p className="mt-6 text-[11px] uppercase tracking-[0.4em] text-royal-dim">
            Restaurant POS &amp; Management
          </p>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center px-6 py-14">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Staff sign in
          </p>
          <h2 className="mt-3 font-display text-3xl">Welcome back</h2>

          <label className="mt-10 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
              Staff ID or username
            </span>
            <input
              type="text"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              autoComplete="username"
              placeholder="e.g. RB-001"
              className="mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-base text-royal-cream placeholder:text-royal-dim/50 transition-colors duration-150 focus:border-royal-accent focus:outline-none"
            />
          </label>

          <label className="mt-8 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim">
              PIN / password
            </span>
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••"
              className="mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-base text-royal-cream placeholder:text-royal-dim/50 transition-colors duration-150 focus:border-royal-accent focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className="mt-10 h-12 w-full rounded-full border border-royal-accent text-sm font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors duration-150 hover:bg-royal-accent hover:text-royal-bg"
          >
            Enter
          </button>

          <p className="mt-6 text-center text-[11px] leading-5 text-royal-dim/80">
            Preview build — real authentication connects in Step 3.
            <br />
            Press Enter to explore the app shell.
          </p>
        </form>
      </div>
    </main>
  );
}
