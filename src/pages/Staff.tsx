import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, roleAtLeast, type StaffRole } from "@contracts/roles";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

// ---------------------------------------------------------------------------
// Full-profile form state — every field optional, strings only ("" = unset).
// ---------------------------------------------------------------------------
interface ProfileForm {
  phone: string;
  email: string;
  gender: "" | "male" | "female" | "other";
  dateOfBirth: string;
  address: string;
  stateOfOrigin: string;
  employmentDate: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorAddress: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  bankName: string;
  bankAccountNumber: string;
}

const EMPTY_PROFILE: ProfileForm = {
  phone: "",
  email: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  stateOfOrigin: "",
  employmentDate: "",
  guarantorName: "",
  guarantorPhone: "",
  guarantorAddress: "",
  nextOfKinName: "",
  nextOfKinPhone: "",
  bankName: "",
  bankAccountNumber: "",
};

type StaffRow = {
  id: number;
  staffCode: string;
  name: string;
  username: string;
  role: StaffRole;
  active: boolean;
  phone: string | null;
  email: string | null;
  gender: "male" | "female" | "other" | null;
  dateOfBirth: string | null;
  address: string | null;
  stateOfOrigin: string | null;
  employmentDate: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantorAddress: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
};

function profileFromRow(s: StaffRow): ProfileForm {
  return {
    phone: s.phone ?? "",
    email: s.email ?? "",
    gender: s.gender ?? "",
    dateOfBirth: s.dateOfBirth ?? "",
    address: s.address ?? "",
    stateOfOrigin: s.stateOfOrigin ?? "",
    employmentDate: s.employmentDate ?? "",
    guarantorName: s.guarantorName ?? "",
    guarantorPhone: s.guarantorPhone ?? "",
    guarantorAddress: s.guarantorAddress ?? "",
    nextOfKinName: s.nextOfKinName ?? "",
    nextOfKinPhone: s.nextOfKinPhone ?? "",
    bankName: s.bankName ?? "",
    bankAccountNumber: s.bankAccountNumber ?? "",
  };
}

/** "" → undefined (create) — enum/date fields reject empty strings. */
function profileForCreate(p: ProfileForm) {
  const orUndef = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    phone: orUndef(p.phone),
    email: orUndef(p.email),
    gender: p.gender === "" ? undefined : p.gender,
    dateOfBirth: orUndef(p.dateOfBirth),
    address: orUndef(p.address),
    stateOfOrigin: orUndef(p.stateOfOrigin),
    employmentDate: orUndef(p.employmentDate),
    guarantorName: orUndef(p.guarantorName),
    guarantorPhone: orUndef(p.guarantorPhone),
    guarantorAddress: orUndef(p.guarantorAddress),
    nextOfKinName: orUndef(p.nextOfKinName),
    nextOfKinPhone: orUndef(p.nextOfKinPhone),
    bankName: orUndef(p.bankName),
    bankAccountNumber: orUndef(p.bankAccountNumber),
  };
}

/** "" → null (update) — so a manager can CLEAR a field, not just leave it. */
function profileForUpdate(p: ProfileForm) {
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    phone: orNull(p.phone),
    email: orNull(p.email),
    gender: p.gender === "" ? null : p.gender,
    dateOfBirth: orNull(p.dateOfBirth),
    address: orNull(p.address),
    stateOfOrigin: orNull(p.stateOfOrigin),
    employmentDate: orNull(p.employmentDate),
    guarantorName: orNull(p.guarantorName),
    guarantorPhone: orNull(p.guarantorPhone),
    guarantorAddress: orNull(p.guarantorAddress),
    nextOfKinName: orNull(p.nextOfKinName),
    nextOfKinPhone: orNull(p.nextOfKinPhone),
    bankName: orNull(p.bankName),
    bankAccountNumber: orNull(p.bankAccountNumber),
  };
}

/** The 14 optional profile fields, as a responsive grid. */
function ProfileFields({
  value,
  onChange,
  prefix,
}: {
  value: ProfileForm;
  onChange: (next: ProfileForm) => void;
  prefix: string;
}) {
  const set = (key: keyof ProfileForm) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });

  const text = (
    key: keyof ProfileForm,
    label: string,
    opts: { type?: string; placeholder?: string; maxLength?: number } = {},
  ) => (
    <label className="block" key={key}>
      <span className={labelCls}>{label}</span>
      <input
        type={opts.type ?? "text"}
        value={value[key]}
        onChange={set(key)}
        placeholder={opts.placeholder}
        maxLength={opts.maxLength}
        data-testid={`${prefix}-${key}`}
        className={inputCls}
      />
    </label>
  );

  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      {text("phone", "Phone number", { placeholder: "e.g. 0803 000 1122", maxLength: 40 })}
      {text("email", "Email", { type: "email", placeholder: "name@example.com", maxLength: 120 })}
      <label className="block">
        <span className={labelCls}>Gender</span>
        <select
          value={value.gender}
          onChange={set("gender")}
          data-testid={`${prefix}-gender`}
          className={`${inputCls} bg-royal-bgsoft`}
        >
          <option value="" className="bg-royal-bgsoft">—</option>
          <option value="male" className="bg-royal-bgsoft">Male</option>
          <option value="female" className="bg-royal-bgsoft">Female</option>
          <option value="other" className="bg-royal-bgsoft">Other</option>
        </select>
      </label>
      {text("dateOfBirth", "Date of birth", { type: "date" })}
      {text("address", "Home address", { maxLength: 255 })}
      {text("stateOfOrigin", "State of origin", { maxLength: 60 })}
      {text("employmentDate", "Employment date", { type: "date" })}
      {text("bankName", "Bank name", { maxLength: 80 })}
      {text("bankAccountNumber", "Bank account number", { maxLength: 20 })}
      <div className="sm:col-span-2">
        <p className="mb-4 mt-2 border-t border-royal-line/60 pt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim/70">
          Guarantor & next of kin
        </p>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {text("guarantorName", "Guarantor name", { maxLength: 120 })}
          {text("guarantorPhone", "Guarantor phone", { maxLength: 40 })}
          <div className="sm:col-span-2">
            {text("guarantorAddress", "Guarantor address", { maxLength: 255 })}
          </div>
          {text("nextOfKinName", "Next of kin name", { maxLength: 120 })}
          {text("nextOfKinPhone", "Next of kin phone", { maxLength: 40 })}
        </div>
      </div>
    </div>
  );
}

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
      setProfile({ ...EMPTY_PROFILE });
      setShowMoreDetails(false);
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
  const [profile, setProfile] = useState<ProfileForm>({ ...EMPTY_PROFILE });
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffRow | null>(null);

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    createMutation.mutate({ ...form, ...profileForCreate(profile) });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Staff accounts
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Create sign-ins for your team, record their full employment
            details, and control who is active. You can only manage roles
            below your own.
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

          <button
            type="button"
            onClick={() => setShowMoreDetails((v) => !v)}
            data-testid="staff-create-more"
            className="mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim transition-colors hover:text-royal-accent"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showMoreDetails ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
            {showMoreDetails
              ? "Hide employment details"
              : "Add full employment details (phone, guarantor, bank, …)"}
          </button>
          {showMoreDetails && (
            <div className="mt-6">
              <ProfileFields value={profile} onChange={setProfile} prefix="staff-create" />
            </div>
          )}

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
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(list.data as StaffRow[]).map((staff) => {
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
                      <td className="px-5 py-3.5 text-royal-dim">{staff.phone ?? "—"}</td>
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
                                title="Edit full profile"
                                onClick={() => setEditing(staff)}
                                data-testid={`staff-edit-${staff.id}`}
                                className="border border-royal-line p-2 text-royal-dim transition-colors hover:border-royal-accent hover:text-royal-accent"
                              >
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
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

      {editing && (
        <StaffEditModal
          staff={editing}
          roles={roles.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            utils.staff.list.invalidate();
            setNotice(`${editing.name}'s profile was updated.`);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StaffEditModal({
  staff,
  roles,
  onClose,
  onSaved,
}: {
  staff: StaffRow;
  roles: readonly StaffRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [core, setCore] = useState({
    name: staff.name,
    username: staff.username,
    staffCode: staff.staffCode,
    role: staff.role,
  });
  const [profile, setProfile] = useState<ProfileForm>(profileFromRow(staff));
  const [error, setError] = useState<string | null>(null);

  const updateMutation = trpc.staff.updateProfile.useMutation({
    onSuccess: () => onSaved(),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    updateMutation.mutate({
      id: staff.id,
      name: core.name.trim(),
      username: core.username.trim(),
      staffCode: core.staffCode.trim(),
      role: core.role,
      ...profileForUpdate(profile),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="royal-scroll relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto border border-royal-line bg-royal-bgsoft"
        data-testid="staff-edit-modal"
      >
        <div className="flex items-start justify-between border-b border-royal-line px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              Edit staff profile
            </p>
            <p className="mt-1 font-display text-2xl text-royal-cream">{staff.name}</p>
            <p className="mt-0.5 text-xs text-royal-dim">
              {staff.staffCode} · {ROLE_LABEL[staff.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-royal-dim transition-colors hover:text-royal-cream"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Full name</span>
              <input
                required
                value={core.name}
                onChange={(e) => setCore({ ...core, name: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Username</span>
              <input
                required
                value={core.username}
                onChange={(e) => setCore({ ...core, username: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Staff code</span>
              <input
                required
                value={core.staffCode}
                onChange={(e) => setCore({ ...core, staffCode: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Role</span>
              <select
                value={core.role}
                onChange={(e) => setCore({ ...core, role: e.target.value as StaffRole })}
                className={`${inputCls} bg-royal-bgsoft`}
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-royal-bgsoft">
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mb-4 mt-8 border-t border-royal-line/60 pt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim/70">
            Employment details
          </p>
          <ProfileFields value={profile} onChange={setProfile} prefix="staff-edit" />

          {error && (
            <p className="mt-6 border-l-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="mt-8 flex items-center gap-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="staff-edit-save"
              className="flex h-11 items-center gap-2 rounded-full border border-royal-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg disabled:opacity-60"
            >
              {updateMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Save profile
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs uppercase tracking-[0.2em] text-royal-dim hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
