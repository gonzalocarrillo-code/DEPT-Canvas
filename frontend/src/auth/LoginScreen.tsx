import { useNavigate } from "react-router";
import { Hexagon, KeyRound, ShieldCheck } from "lucide-react";
import { useAuthStore } from "./authStore";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "microsoft", label: "Continue with Microsoft" },
  { id: "okta", label: "Continue with Okta (SAML)" },
];

export function LoginScreen() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);

  const onSignIn = (provider: string) => {
    signIn(provider);
    navigate("/", { replace: true });
  };

  return (
    <div className="grid min-h-full place-items-center bg-dot-grid px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Hexagon className="size-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">DEPT Canvas</span>
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enterprise SSO only — no passwords.
        </p>

        <div className="mt-6 grid gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onSignIn(p.id)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <KeyRound className="size-4 text-muted-foreground" />
              {p.label}
            </button>
          ))}
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" />
          OIDC / SAML via the edge · tenant-scoped tokens · no credentials in the browser.
        </p>
      </div>
    </div>
  );
}
