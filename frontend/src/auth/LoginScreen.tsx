import { Button, escapeHtml } from "../design/Button.js";

export type SsoProtocol = "saml" | "oidc";

export interface SsoProvider {
  readonly id: string;
  readonly label: string;
  readonly protocol: SsoProtocol;
  readonly tenantDomain: string;
}

export interface LoginScreenState {
  readonly workspaceName: string;
  readonly providers: readonly SsoProvider[];
}

export const defaultLoginState: LoginScreenState = {
  workspaceName: "DEPT Canvas",
  providers: [
    {
      id: "dept-saml",
      label: "Continue with SAML",
      protocol: "saml",
      tenantDomain: "brand.example",
    },
    {
      id: "dept-oidc",
      label: "Continue with OIDC",
      protocol: "oidc",
      tenantDomain: "workspace.example",
    },
  ],
};

export function renderLoginScreen(state: LoginScreenState = defaultLoginState): string {
  const providers = state.providers
    .map(
      (provider) => `<li>
        <a class="dc-auth-provider" data-sso-provider="${escapeHtml(provider.id)}" data-sso-protocol="${provider.protocol}" href="/auth/${provider.protocol}/start?domain=${encodeURIComponent(provider.tenantDomain)}">
          ${escapeHtml(provider.label)}
        </a>
      </li>`,
    )
    .join("");

  return `<main class="dc-auth-screen" data-screen="login" data-auth-mode="sso">
    <section class="dc-auth-panel" aria-label="Sign in">
      <p class="dc-kicker">Enterprise SSO</p>
      <h1>Sign in</h1>
      <p>${escapeHtml(state.workspaceName)} uses your company identity provider.</p>
      <ul class="dc-auth-provider-list" aria-label="SSO providers">${providers}</ul>
      <p class="dc-auth-note" data-password-storage="none">No passwords are stored by DEPT Canvas.</p>
      ${Button({ label: "Use another workspace", tone: "ghost" })}
    </section>
  </main>`;
}

export default renderLoginScreen;
