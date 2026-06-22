import type { Capability } from "../auth/rbac.js";
import { Button, escapeHtml } from "../design/Button.js";

export interface TenantSettingsScreenState {
  readonly tenantName: string;
  readonly tenantId: string;
  readonly allowedDomains: readonly string[];
  readonly ssoProtocols: readonly ("saml" | "oidc")[];
  readonly dataRegion: string;
  readonly capabilities: readonly Capability[];
}

export const defaultTenantSettingsState: TenantSettingsScreenState = {
  tenantName: "DEPT",
  tenantId: "tenant-dept",
  allowedDomains: ["deptagency.com", "dept.example"],
  ssoProtocols: ["saml", "oidc"],
  dataRegion: "EU",
  capabilities: ["scene:read", "tenant:admin"],
};

export function canManageTenantSettings(
  capabilities: readonly Capability[],
): boolean {
  return capabilities.includes("tenant:admin");
}

export function renderTenantSettingsScreen(
  state: TenantSettingsScreenState = defaultTenantSettingsState,
): string {
  const isManageable = canManageTenantSettings(state.capabilities);
  const domains = state.allowedDomains
    .map((domain) => `<li>${escapeHtml(domain)}</li>`)
    .join("");
  const protocols = state.ssoProtocols
    .map((protocol) => `<span data-sso-protocol="${protocol}">${protocol.toUpperCase()}</span>`)
    .join("");

  return `<main class="dc-admin-screen" data-screen="tenant-settings" data-tenant-id="${escapeHtml(state.tenantId)}">
    <section aria-label="Tenant settings">
      <p class="dc-kicker">Tenant</p>
      <h1>Settings</h1>
      <dl>
        <div><dt>Name</dt><dd>${escapeHtml(state.tenantName)}</dd></div>
        <div><dt>Tenant ID</dt><dd>${escapeHtml(state.tenantId)}</dd></div>
        <div><dt>Data region</dt><dd>${escapeHtml(state.dataRegion)}</dd></div>
        <div><dt>SSO protocols</dt><dd>${protocols}</dd></div>
      </dl>
      <section aria-label="Allowed domains">
        <h2>Allowed domains</h2>
        <ul>${domains}</ul>
      </section>
      ${Button({ label: "Save settings", tone: "primary", disabled: !isManageable })}
    </section>
  </main>`;
}

export default renderTenantSettingsScreen;
