import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, roleAtLeast, type StaffRole } from "@contracts/roles";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className="border border-royal-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
      {ROLE_LABEL[role]}
    </span>
  );
}

export default function StaffPage() {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();

  const list = trpc.staff.list.useQuery();
  const roles = trpc.staff.manageableRoles.useQuery();

  const createMutation = trpc.staff.create.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      setForm({ name: "", username: "", staffCode: "", role: "sales", secret: "" });
      setNotice("Account created. Share the PIN/password with the staff member.");
    },
    onError: (err) => setNotice(err.message),
  });
  const setActiveMutation = trpc.staff.setActive.useMutation({
    onSuccess: () => utils.staff.list.invalidate(),
    onError: (err) => setNotice(err.message),
  });
  const resetMutation = trpc.staff.resetSecret.useMutation({
    onSuccess: (data) =>
      setNotice(
        `New PIN/password for ${data.name}: ${data.secret} — write it down now, it will not be shown again.`,
      ),
    onError: (err) => setNotice(err.message),
  });

  const [form, setForm] = useState({
    name: "",
    username: "",
    staffCode: "",
    role: "sales" as StaffRole,
    secret: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    createMutation.mutate(form);
  }

  /** Admins cannot act on accounts at or above their own level (server enforces too). */
  function canManage(targetRole: StaffRole) {
    if (!me) return false;
    if (me.role === "superadmin") return true;
    return !roleAtLeast(targetRole, me.role);
  }

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Staff accounts
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Create sign-ins for your team and control who is active. You can
            only manage roles below your own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New account
        </button>
      </div>

      {notice && (
        <p className="border-l-2 border-royal-accent bg-royal-faint/30 px-4 py-3 text-sm leading-6 text-royal-cream">
          {notice}
        </p>
      )}

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="border border-royal-line bg-royal-bgsoft p-6"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            New staff account
          </p>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Full name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Amina Yusuf"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Username</span>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. amina"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Staff code</span>
              <input
                required
                value={form.staffCode}
                onChange={(e) => setForm({ ...form, staffCode: e.target.value })}
                placeholder="e.g. RB-102"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Role</span>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as StaffRole })
                }
                className={`${inputCls} bg-royal-bgsoft`}
              >
                {(roles.data ?? []).map((r) => (
                  <option key={r} value={r} className="bg-royal-bgsoft">
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Starting PIN / password</span>
              <input
                required
                minLength={4}
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="At least 4 characters"
                className={inputCls}
              />
            </label>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex h-11 items-center gap-2 rounded-full border border-royal-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:opacity-60"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Create account
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs uppercase tracking-[0.2em] text-royal-dim hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Accounts table */}
      <div className="border border-royal-line">
        <div className="border-b border-royal-line px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
            {list.data ? `${list.data.length} account${list.data.length === 1 ? "" : "s"}` : "Accounts"}
          </p>
        </div>

        {list.isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-royal-accent" strokeWidth={1.5} />
          </div>
        )}

        {list.isError && (
          <p className="px-5 py-10 text-center text-sm text-rose-300">
            {list.error.message}
          </p>
        )}

        {list.data && (
          <div className="royal-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-royal-line text-[10px] uppercase tracking-[0.2em] text-royal-dim/70">
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Username</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((staff) => {
                  const isSelf = staff.id === me?.id;
                  const manageable = canManage(staff.role) && !isSelf;
                  return (
                    <tr
                      key={staff.id}
                      className="border-b border-royal-line/50 last:border-0 hover:bg-royal-faint/20"
                    >
                      <td className="px-5 py-3.5 text-royal-dim">{staff.staffCode}</td>
                      <td className="px-5 py-3.5 text-royal-cream">
                        {staff.name}
                        {isSelf && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-royal-accent">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-royal-dim">{staff.username}</td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={staff.role} />
                      </td>
                      <td className="px-5 py-3.5">
                        {staff.active ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Active
                          </span>
                        ) : (
                          <span className="text-xs text-royal-dim">Disabled</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {manageable ? (
                            <>
                              <button
                                type="button"
                                title="Reset PIN / password"
                                disabled={resetMutation.isPending}
                                onClick={() => {
                                  setNotice(null);
                                  resetMutation.mutate({ id: staff.id });
                                }}
                                className="border border-royal-line p-2 text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-40"
                              >
                                <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                title={staff.active ? "Deactivate" : "Reactivate"}
                                disabled={setActiveMutation.isPending}
                                onClick={() => {
                                  setNotice(null);
                                  setActiveMutation.mutate({
                                    id: staff.id,
                                    active: !staff.active,
                                  });
                                }}
                                className={`border p-2 transition-colors disabled:opacity-40 ${
                                  staff.active
                                    ? "border-royal-line text-royal-dim hover:border-rose-500/60 hover:text-rose-400"
                                    : "border-royal-line text-royal-dim hover:border-emerald-500/60 hover:text-emerald-400"
                                }`}
                              >
                                {staff.active ? (
                                  <PowerOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : (
                                  <Power className="h-3.5 w-3.5" strokeWidth={1.75} />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.15em] text-royal-dim/40">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
