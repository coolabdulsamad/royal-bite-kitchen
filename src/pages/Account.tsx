import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@contracts/roles";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

/** Password field with a show/hide eye toggle. */
function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  testId?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="mt-6 block">
      <span className={labelCls}>{label}</span>
      <div className="relative mt-2">
        <input
          type={show ? "text" : "password"}
          required
          minLength={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          data-testid={testId}
          className="w-full border-b border-royal-line bg-transparent py-2.5 pr-10 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          data-testid={testId ? `${testId}-toggle` : undefined}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-royal-dim transition-colors hover:text-royal-cream"
        >
          {show ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </label>
  );
}

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export default function AccountPage() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const profile = me.data?.profile ?? null;

  // ── self-editable details (username + phone — everything else is manager-only)
  const [username, setUsername] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [detailsNotice, setDetailsNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setUsername(null);
      setPhone(null);
      setDetailsNotice({ kind: "ok", text: "Your details were saved." });
    },
    onError: (err) => setDetailsNotice({ kind: "err", text: err.message }),
  });

  function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();
    setDetailsNotice(null);
    updateMutation.mutate({
      ...(username !== null && username !== user?.username ? { username } : {}),
      ...(phone !== null && phone !== (profile?.phone ?? "") ? { phone } : {}),
    });
  }

  // ── change secret
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

  const readOnlyRows: Array<[string, string]> = profile
    ? [
        ["Email", profile.email ?? ""],
        ["Gender", profile.gender ? (GENDER_LABEL[profile.gender] ?? profile.gender) : ""],
        ["Date of birth", profile.dateOfBirth ?? ""],
        ["Address", profile.address ?? ""],
        ["State of origin", profile.stateOfOrigin ?? ""],
        ["Employment date", profile.employmentDate ?? ""],
        ["Guarantor", profile.guarantorName ?? ""],
        ["Guarantor phone", profile.guarantorPhone ?? ""],
        ["Guarantor address", profile.guarantorAddress ?? ""],
        ["Next of kin", profile.nextOfKinName ?? ""],
        ["Next of kin phone", profile.nextOfKinPhone ?? ""],
        ["Bank", profile.bankName ?? ""],
        ["Account number", profile.bankAccountNumber ?? ""],
      ]
    : [];

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

      {/* Editable details — username + phone only */}
      <form onSubmit={handleDetailsSubmit} className="mt-8 border border-royal-line p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
          My details
        </p>
        <p className="mt-2 text-xs leading-5 text-royal-dim">
          You can change your username and phone number yourself. Everything
          else below is recorded by management — ask a manager to update it.
        </p>

        <label className="mt-6 block">
          <span className={labelCls}>Username</span>
          <input
            value={username ?? user?.username ?? ""}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={60}
            pattern="[a-zA-Z0-9._-]+"
            data-testid="account-username"
            className={inputCls}
          />
        </label>
        <label className="mt-6 block">
          <span className={labelCls}>Phone number</span>
          <input
            value={phone ?? profile?.phone ?? ""}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="e.g. 0803 000 1122"
            data-testid="account-phone"
            className={inputCls}
          />
        </label>

        {detailsNotice && (
          <p
            className={`mt-6 border-l-2 px-3 py-2 text-sm ${
              detailsNotice.kind === "ok"
                ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/70 bg-rose-500/10 text-rose-300"
            }`}
          >
            {detailsNotice.text}
          </p>
        )}

        <button
          type="submit"
          disabled={
            updateMutation.isPending ||
            (username === null && phone === null)
          }
          data-testid="account-save-details"
          className="mt-8 flex h-11 items-center gap-2 rounded-full border border-royal-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:opacity-60"
        >
          {updateMutation.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Save my details
        </button>
      </form>

      {/* Full profile — read-only, recorded by management */}
      {readOnlyRows.length > 0 && (
        <div className="mt-8 border border-royal-line p-6" data-testid="account-profile">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Employment record
          </p>
          <p className="mt-2 text-xs leading-5 text-royal-dim">
            Recorded by management. Contact a manager if anything is wrong.
          </p>
          <div className="mt-4 divide-y divide-royal-line/60">
            {readOnlyRows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim">
                  {label}
                </span>
                <span className={`text-right text-sm ${value ? "text-royal-cream" : "text-royal-dim/50"}`}>
                  {value || "—"}
                </span>
              </div>
            ))}
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

        <PasswordInput
          label="Current PIN / password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          testId="account-current-secret"
        />
        <PasswordInput
          label="New PIN / password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          placeholder="At least 4 characters"
          testId="account-next-secret"
        />
        <PasswordInput
          label="Repeat new PIN / password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          testId="account-confirm-secret"
        />

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
