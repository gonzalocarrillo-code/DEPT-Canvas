import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/auth/authStore";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/auth/rbac";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";

export function ProfileScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  if (!user) return null;
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 py-10">
        <p className="text-meta">ACCOUNT</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profile</h1>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {initials}
            </span>
            <div>
              <p className="text-base font-semibold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 text-sm">
            <Field label="Role" value={ROLE_LABELS[user.role]} note={ROLE_DESCRIPTIONS[user.role]} />
            <Field label="Tenant" value={user.tenant} />
            <Field label="Signed in via" value={user.provider} cap />
          </dl>

          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              signOut();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  note,
  cap,
}: {
  label: string;
  value: string;
  note?: string;
  cap?: boolean;
}) {
  return (
    <div className="border-b border-border pb-2">
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className={cn("font-medium", cap && "capitalize")}>{value}</dd>
      </div>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
