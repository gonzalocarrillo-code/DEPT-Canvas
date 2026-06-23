import { useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/auth/authStore";
import {
  ALL_CAPABILITIES,
  ALL_ROLES,
  CAPABILITY_LABELS,
  ROLE_LABELS,
  roleHasCapability,
  type Role,
} from "@/auth/rbac";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const INITIAL_MEMBERS: Member[] = [
  { id: "u1", name: "Gonzalo Carrillo", email: "gonzalo.carrillo@deptagency.com", role: "tenant_admin" },
  { id: "u2", name: "Maya Lind", email: "maya.lind@deptagency.com", role: "brand_owner" },
  { id: "u3", name: "Tom Reyes", email: "tom.reyes@deptagency.com", role: "approver" },
  { id: "u4", name: "Aria Chen", email: "aria.chen@deptagency.com", role: "creator" },
  { id: "u5", name: "Sam Okoro", email: "sam.okoro@client.com", role: "viewer" },
];

const inputCls =
  "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60";

export function AdminScreen() {
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [tenantName, setTenantName] = useState(user?.tenant ?? "DEPT");
  const [defaultRole, setDefaultRole] = useState<Role>("creator");

  if (user?.role !== "tenant_admin") {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <ShieldAlert className="mx-auto size-7 text-lock" />
          <p className="mt-3 text-sm font-medium">Tenant admin access required</p>
          <p className="text-meta mt-1">YOUR ROLE: {ROLE_LABELS[user?.role ?? "viewer"].toUpperCase()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="text-meta">GOVERNANCE</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Team & access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles reflect here; the edge + scene-MCP server enforce every capability.
        </p>

        {/* Team & roles */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Members</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.email}</td>
                    <td className="px-3 py-2">
                      <select
                        className={inputCls}
                        value={m.role}
                        onChange={(e) =>
                          setMembers((prev) =>
                            prev.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Role } : x)),
                          )
                        }
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Capability matrix */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Capability matrix</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Role</th>
                  {ALL_CAPABILITIES.map((c) => (
                    <th key={c} className="px-3 py-2 text-center font-medium text-muted-foreground">
                      {CAPABILITY_LABELS[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_ROLES.map((r) => (
                  <tr key={r} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{ROLE_LABELS[r]}</td>
                    {ALL_CAPABILITIES.map((c) => (
                      <td key={c} className="px-3 py-2 text-center">
                        {roleHasCapability(r, c) ? (
                          <Check className="mx-auto size-4 text-success" />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tenant settings */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Tenant settings</h2>
          <div className="mt-3 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">Workspace name</span>
              <input className={inputCls} value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">Default role for new members</span>
              <select className={inputCls} value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as Role)}>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">SSO providers</span>
              <div className="flex flex-wrap gap-1.5">
                {["Google", "Microsoft", "Okta (SAML)"].map((p) => (
                  <span
                    key={p}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                      "border-success/40 text-success",
                    )}
                  >
                    <Check className="size-3" /> {p}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">Seats</span>
              <span className="font-mono text-sm text-foreground">{members.length} / 25</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
