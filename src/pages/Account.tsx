import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@contracts/roles";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const changeMutation = trpc.auth.changeSecret.useMutation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (next !== confirm) {
      setNotice({ kind: "err", text: "New PIN/passwords do not match." });
      return;
    }
    changeMutation.mutate(
      { current, next },
      {
        onSuccess: () => {
          setNotice({
            kind: "ok",
            text: "PIN/password changed. Please sign in again with the new one.",
          });
          setTimeout(() => logout(), 1800);
        },
        onError: (err) => setNotice({ kind: "err", text: err.message }),
      },
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
        My account
      </p>

      {/* Profile card */}
      {user && (
        <div className="mt-6 flex items-center gap-4 border border-royal-line bg-royal-bgsoft p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-royal-line text-sm font-semibold text-royal-accent">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <p className="text-base text-royal-cream">{user.name}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-royal-dim">
              {ROLE_LABEL[user.role]} · {user.staffCode} · @{user.username}
            </p>
          </div>
        </div>
      )}

      {/* Change secret */}
      <form
        onSubmit={handleSubmit}
        className="mt-8 border border-royal-line p-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          Change PIN / password
        </p>

        <label className="mt-8 block">
          <span className={labelCls}>Current PIN / password</span>
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </label>
        <label className="mt-6 block">
          <span className={labelCls}>New PIN / password</span>
          <input
            type="password"
            required
            minLength={4}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 4 characters"
            className={inputCls}
          />
        </label>
        <label className="mt-6 block">
          <span className={labelCls}>Repeat new PIN / password</span>
          <input
            type="password"
            required
            minLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>

        {notice && (
          <p
            className={`mt-6 border-l-2 px-3 py-2 text-sm ${
              notice.kind === "ok"
                ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/70 bg-rose-500/10 text-rose-300"
            }`}
          >
            {notice.text}
          </p>
        )}

        <button
          type="submit"
          disabled={changeMutation.isPending}
          className="mt-8 flex h-11 items-center gap-2 rounded-full border border-royal-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:opacity-60"
        >
          {changeMutation.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Save new PIN / password
        </button>
      </form>
    </div>
  );
}
