import { useState, type FormEvent } from "react";
import {
  ChevronDown,
  HandCoins,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Power,
  PowerOff,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@contracts/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@contracts/payments";
import { roleAtLeast } from "@contracts/roles";

const inputCls =
  "mt-2 w-full border-b border-royal-line bg-transparent py-2.5 text-sm text-royal-cream placeholder:text-royal-dim/50 transition-colors focus:border-royal-accent focus:outline-none";
const labelCls =
  "text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim";

// ---------------------------------------------------------------------------
// Full-profile form state — every field optional, strings only ("" = unset).
// ---------------------------------------------------------------------------
interface CustomerProfileForm {
  email: string;
  gender: "" | "male" | "female" | "other";
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  alternatePhone: string;
  occupation: string;
  guarantorName: string;
  guarantorPhone: string;
  referralSource: string;
}

const EMPTY_PROFILE: CustomerProfileForm = {
  email: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  city: "",
  state: "",
  alternatePhone: "",
  occupation: "",
  guarantorName: "",
  guarantorPhone: "",
  referralSource: "",
};

/** "" → undefined (create) — enum/date fields reject empty strings. */
function profileForCreate(p: CustomerProfileForm) {
  const orUndef = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    email: orUndef(p.email),
    gender: p.gender === "" ? undefined : p.gender,
    dateOfBirth: orUndef(p.dateOfBirth),
    address: orUndef(p.address),
    city: orUndef(p.city),
    state: orUndef(p.state),
    alternatePhone: orUndef(p.alternatePhone),
    occupation: orUndef(p.occupation),
    guarantorName: orUndef(p.guarantorName),
    guarantorPhone: orUndef(p.guarantorPhone),
    referralSource: orUndef(p.referralSource),
  };
}

/** "" → null (update) — so a manager can CLEAR a field, not just leave it. */
function profileForUpdate(p: CustomerProfileForm) {
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    email: orNull(p.email),
    gender: p.gender === "" ? null : p.gender,
    dateOfBirth: orNull(p.dateOfBirth),
    address: orNull(p.address),
    city: orNull(p.city),
    state: orNull(p.state),
    alternatePhone: orNull(p.alternatePhone),
    occupation: orNull(p.occupation),
    guarantorName: orNull(p.guarantorName),
    guarantorPhone: orNull(p.guarantorPhone),
    referralSource: orNull(p.referralSource),
  };
}

/** The 11 optional profile fields, as a responsive grid. */
function CustomerProfileFields({
  value,
  onChange,
  prefix,
}: {
  value: CustomerProfileForm;
  onChange: (next: CustomerProfileForm) => void;
  prefix: string;
}) {
  const set =
    (key: keyof CustomerProfileForm) =>
    (e: { target: { value: string } }) =>
      onChange({ ...value, [key]: e.target.value });

  const text = (
    key: keyof CustomerProfileForm,
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
      {text("alternatePhone", "Alternate phone", { maxLength: 40 })}
      <div className="sm:col-span-2">
        {text("address", "Home / work address", { maxLength: 255 })}
      </div>
      {text("city", "City", { maxLength: 60 })}
      {text("state", "State", { maxLength: 60 })}
      {text("occupation", "Occupation", { maxLength: 80 })}
      {text("referralSource", "How they found us", { placeholder: "Walk-in, referral, Instagram…", maxLength: 80 })}
      <div className="sm:col-span-2">
        <p className="mb-4 mt-2 border-t border-royal-line/60 pt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim/70">
          Guarantor (for credit customers)
        </p>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {text("guarantorName", "Guarantor name", { maxLength: 120 })}
          {text("guarantorPhone", "Guarantor phone", { maxLength: 40 })}
        </div>
      </div>
    </div>
  );
}

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CustomersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isManager = user ? roleAtLeast(user.role, "manager") : false;

  const [search, setSearch] = useState("");
  const [owingOnly, setOwingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = trpc.customers.list.useQuery({
    search: search || undefined,
    owingOnly,
    pageSize: 100,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [profile, setProfile] = useState<CustomerProfileForm>({ ...EMPTY_PROFILE });
  const [notice, setNotice] = useState<string | null>(null);

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setForm({ name: "", phone: "", notes: "" });
      setProfile({ ...EMPTY_PROFILE });
      setShowMoreDetails(false);
      setShowCreate(false);
      setNotice("Customer added — you can now attach them at checkout.");
    },
    onError: (err) => setNotice(err.message),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    createMutation.mutate({
      name: form.name,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
      ...profileForCreate(profile),
    });
  }

  const rows = list.data?.rows ?? [];
  const owingCount = rows.filter((r) => r.creditBalanceKobo > 0).length;
  const totalOwedKobo = rows.reduce((s, r) => s + r.creditBalanceKobo, 0);

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Customers & credit tabs
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-royal-dim">
            Regulars and owing customers, one tap away. Attach a customer at
            checkout to track their visits — or let them pay later on credit.
          </p>
          {owingCount > 0 && (
            <p className="mt-2 text-sm font-semibold text-amber-400">
              {formatNaira(totalOwedKobo)} outstanding across {owingCount}{" "}
              customer{owingCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-royal-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-accent transition-colors hover:bg-royal-accent hover:text-royal-bg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New customer
        </button>
      </div>

      {notice && (
        <div className="border border-royal-line bg-royal-panel px-4 py-3 text-sm text-royal-cream">
          {notice}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="border border-royal-line bg-royal-panel p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
            Add a customer
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mama Nkechi"
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0803 000 1122"
                maxLength={40}
              />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                className={inputCls}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional — e.g. office next door"
                maxLength={255}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMoreDetails((v) => !v)}
            data-testid="customer-create-more"
            className="mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim transition-colors hover:text-royal-accent"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showMoreDetails ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
            {showMoreDetails
              ? "Hide full details"
              : "Add full details (address, gender, guarantor, …)"}
          </button>
          {showMoreDetails && (
            <div className="mt-6">
              <CustomerProfileFields value={profile} onChange={setProfile} prefix="customer-create" />
            </div>
          )}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-full bg-royal-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-bg transition-opacity disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              )}
              Add customer
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-full border border-royal-line px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:text-royal-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 border-b border-royal-line pb-2">
          <Search className="h-4 w-4 shrink-0 text-royal-dim" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full bg-transparent text-sm text-royal-cream placeholder:text-royal-dim/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setOwingOnly((v) => !v)}
          className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
            owingOnly
              ? "border-amber-400 bg-amber-400/10 text-amber-300"
              : "border-royal-line text-royal-dim hover:text-royal-cream"
          }`}
        >
          Owing only
        </button>
      </div>

      {/* List */}
      {list.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-royal-dim">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-royal-line px-6 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-royal-dim" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-royal-dim">
            {search || owingOnly
              ? "No customers match that filter."
              : "No customers yet — add your first regular."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-royal-line border border-royal-line">
          {rows.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-royal-faint/20"
              data-testid={`customer-row-${c.id}`}
            >
              <UserRound
                className={`h-5 w-5 shrink-0 ${c.active ? "text-royal-accent" : "text-royal-dim"}`}
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-royal-cream">
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 text-[9px] uppercase tracking-[0.2em] text-royal-dim">
                      deactivated
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-royal-dim">
                  {c.phone ?? "No phone"}
                  {c.notes ? ` · ${c.notes}` : ""}
                </p>
              </div>
              {c.creditBalanceKobo > 0 ? (
                <span className="shrink-0 rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-400">
                  Owes {formatNaira(c.creditBalanceKobo)}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-royal-dim">No debt</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedId !== null && (
        <CustomerDetailModal
          customerId={selectedId}
          isManager={isManager}
          onClose={() => setSelectedId(null)}
          onChanged={() => utils.customers.list.invalidate()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CustomerDetailModal({
  customerId,
  isManager,
  onClose,
  onChanged,
}: {
  customerId: number;
  isManager: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = trpc.customers.detail.useQuery({ customerId });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "" });
  const [editProfile, setEditProfile] = useState<CustomerProfileForm>({ ...EMPTY_PROFILE });
  const [repayAmount, setRepayAmount] = useState("");
  const [repayMethod, setRepayMethod] = useState<PaymentMethod>("cash");
  const [repayRef, setRepayRef] = useState("");

  function refresh() {
    detail.refetch();
    onChanged();
  }

  const repayMutation = trpc.customers.repay.useMutation({
    onSuccess: () => {
      setRepayAmount("");
      setRepayRef("");
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });
  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });

  const c = detail.data?.customer;
  const busy = repayMutation.isPending || updateMutation.isPending;

  // Merge credit sales + repayments into one ledger, newest first.
  const ledger = [
    ...(detail.data?.creditSales ?? []).map((s) => ({
      key: `s${s.saleId}`,
      at: s.soldAt,
      kind: "sale" as const,
      label: `Credit sale ${s.receiptNo}`,
      sub: `by ${s.cashierName}${s.status === "returned" ? " · returned" : ""}`,
      amountKobo: s.creditKobo,
      sign: +1,
      struck: s.status === "returned",
    })),
    ...(detail.data?.repayments ?? []).map((p) => ({
      key: `p${p.id}`,
      at: p.createdAt,
      kind: "repay" as const,
      label: `Repayment · ${PAYMENT_METHOD_LABEL[p.method]}`,
      sub: `by ${p.receivedByName}${p.reference ? ` · ${p.reference}` : ""}${p.note ? ` · ${p.note}` : ""}`,
      amountKobo: p.amountKobo,
      sign: -1,
      struck: false,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="royal-scroll relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto border border-royal-line bg-royal-bgsoft">
        <div className="flex items-start justify-between border-b border-royal-line px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              Customer
            </p>
            {c && (
              <>
                <p className="mt-1 font-display text-2xl text-royal-cream">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-royal-dim">
                  <Phone className="h-3 w-3" strokeWidth={2} />
                  {c.phone ?? "No phone"}
                  {!c.active && " · deactivated"}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isManager && c && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing((v) => !v);
                    setEditForm({
                      name: c.name,
                      phone: c.phone ?? "",
                      notes: c.notes ?? "",
                    });
                    setEditProfile({
                      email: c.email ?? "",
                      gender: (c.gender as CustomerProfileForm["gender"]) ?? "",
                      dateOfBirth: c.dateOfBirth ?? "",
                      address: c.address ?? "",
                      city: c.city ?? "",
                      state: c.state ?? "",
                      alternatePhone: c.alternatePhone ?? "",
                      occupation: c.occupation ?? "",
                      guarantorName: c.guarantorName ?? "",
                      guarantorPhone: c.guarantorPhone ?? "",
                      referralSource: c.referralSource ?? "",
                    });
                  }}
                  className="p-2 text-royal-dim transition-colors hover:text-royal-accent"
                  aria-label="Edit customer"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateMutation.mutate({ id: customerId, active: !c.active })}
                  className="p-2 text-royal-dim transition-colors hover:text-royal-accent"
                  aria-label={c.active ? "Deactivate customer" : "Reactivate customer"}
                >
                  {c.active ? (
                    <PowerOff className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Power className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-royal-dim transition-colors hover:text-royal-cream"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {detail.isLoading || !c ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-royal-dim">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
          </div>
        ) : (
          <div className="px-6 py-5">
            {/* Balance */}
            <div className="border border-royal-line bg-royal-panel px-5 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-dim">
                Outstanding balance
              </p>
              <p
                className={`mt-1 font-display text-4xl ${
                  c.creditBalanceKobo > 0 ? "text-amber-400" : "text-royal-cream"
                }`}
              >
                {formatNaira(c.creditBalanceKobo)}
              </p>
            </div>

            {error && (
              <p className="mt-4 border-l-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            {/* Profile details */}
            {(() => {
              const rows: Array<[string, string]> = [
                ["Alternate phone", c.alternatePhone ?? ""],
                ["Email", c.email ?? ""],
                ["Gender", c.gender ? (GENDER_LABEL[c.gender] ?? c.gender) : ""],
                ["Date of birth", c.dateOfBirth ?? ""],
                ["Address", c.address ?? ""],
                ["City / State", [c.city, c.state].filter(Boolean).join(", ")],
                ["Occupation", c.occupation ?? ""],
                ["Found us via", c.referralSource ?? ""],
                ["Guarantor", c.guarantorName ?? ""],
                ["Guarantor phone", c.guarantorPhone ?? ""],
                ["Notes", c.notes ?? ""],
              ];
              return (
                <div className="mt-4 border border-royal-line" data-testid="customer-profile">
                  <p className="border-b border-royal-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-dim/70">
                    Profile details
                  </p>
                  <div className="divide-y divide-royal-line/60">
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 px-4 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-dim">
                          {label}
                        </span>
                        <span className={`text-right text-xs ${value ? "text-royal-cream" : "text-royal-dim/50"}`}>
                          {value || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Edit form (manager+) */}
            {editing && (
              <div className="mt-4 border border-royal-line p-4" data-testid="customer-edit-form">
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelCls}>Name</span>
                    <input
                      className={inputCls}
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Phone</span>
                    <input
                      className={inputCls}
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelCls}>Notes</span>
                    <input
                      className={inputCls}
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="mt-4">
                  <CustomerProfileFields value={editProfile} onChange={setEditProfile} prefix="customer-edit" />
                </div>
                <button
                  type="button"
                  disabled={busy || editForm.name.trim().length < 2}
                  data-testid="customer-edit-save"
                  onClick={() =>
                    updateMutation.mutate({
                      id: customerId,
                      name: editForm.name.trim(),
                      phone: editForm.phone.trim() || null,
                      notes: editForm.notes.trim() || null,
                      ...profileForUpdate(editProfile),
                    })
                  }
                  className="mt-4 rounded-full bg-royal-accent px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-bg disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            )}

            {/* Repayment */}
            {c.creditBalanceKobo > 0 && c.active && (
              <div className="mt-4 border border-royal-line p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-royal-accent">
                  <HandCoins className="h-4 w-4" strokeWidth={2} />
                  Record a repayment
                </p>
                <div className="mt-3 flex items-end gap-3">
                  <label className="flex-1">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-royal-dim/70">
                      Amount (₦)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      className={inputCls}
                      placeholder={(c.creditBalanceKobo / 100).toString()}
                    />
                  </label>
                  <div className="flex gap-1">
                    {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRepayMethod(m)}
                        className={`border px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                          repayMethod === m
                            ? "border-royal-accent bg-royal-faint/40 text-royal-cream"
                            : "border-royal-line text-royal-dim hover:text-royal-cream"
                        }`}
                      >
                        {PAYMENT_METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={repayRef}
                  onChange={(e) => setRepayRef(e.target.value)}
                  placeholder="Reference (optional)"
                  className={`${inputCls} mt-2`}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      repayMutation.mutate({
                        customerId,
                        amount: c.creditBalanceKobo / 100,
                        method: repayMethod,
                        reference: repayRef || undefined,
                      })
                    }
                    className="rounded-full border border-royal-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-dim transition-colors hover:text-royal-cream disabled:opacity-50"
                  >
                    Full balance
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !Number.isFinite(Number.parseFloat(repayAmount)) ||
                      Number.parseFloat(repayAmount) <= 0
                    }
                    onClick={() =>
                      repayMutation.mutate({
                        customerId,
                        amount: Number.parseFloat(repayAmount),
                        method: repayMethod,
                        reference: repayRef || undefined,
                      })
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-royal-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-royal-bg disabled:opacity-50"
                  >
                    {repayMutation.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                    )}
                    Save repayment
                  </button>
                </div>
              </div>
            )}

            {/* Ledger */}
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              Credit history
            </p>
            {ledger.length === 0 ? (
              <p className="mt-3 text-sm text-royal-dim">
                No credit activity yet.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-royal-line border border-royal-line">
                {ledger.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          entry.struck
                            ? "text-royal-dim line-through"
                            : "text-royal-cream"
                        }`}
                      >
                        {entry.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-royal-dim">
                        {fmtDate(entry.at)} · {entry.sub}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        entry.sign > 0
                          ? entry.struck
                            ? "text-royal-dim line-through"
                            : "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {entry.sign > 0 ? "+" : "−"}
                      {formatNaira(entry.amountKobo)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
