import type { Role } from "../admin/UserRoleScreen.js";
import { Button, escapeHtml } from "../design/Button.js";

export interface ProfileScreenState {
  readonly displayName: string;
  readonly email: string;
  readonly role: Role;
  readonly tenantName: string;
  readonly identityProvider: string;
  readonly sessionExpiresAt: string;
}

export const defaultProfileState: ProfileScreenState = {
  displayName: "Gonzalo Carrillo",
  email: "gonzalo@example.com",
  role: "creator",
  tenantName: "DEPT",
  identityProvider: "OIDC",
  sessionExpiresAt: "2026-06-22T18:00:00Z",
};

function formatRole(role: Role): string {
  return role.replaceAll("_", " ");
}

export function renderProfileScreen(
  state: ProfileScreenState = defaultProfileState,
): string {
  return `<main class="dc-account-screen" data-screen="profile">
    <section class="dc-account-summary" aria-label="Profile">
      <p class="dc-kicker">Account</p>
      <h1>Profile</h1>
      <dl>
        <div><dt>Name</dt><dd>${escapeHtml(state.displayName)}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(state.email)}</dd></div>
        <div><dt>Tenant</dt><dd>${escapeHtml(state.tenantName)}</dd></div>
        <div><dt>Role</dt><dd data-current-role="${state.role}">${escapeHtml(formatRole(state.role))}</dd></div>
        <div><dt>Identity provider</dt><dd>${escapeHtml(state.identityProvider)}</dd></div>
        <div><dt>Session expires</dt><dd>${escapeHtml(state.sessionExpiresAt)}</dd></div>
      </dl>
      <form action="/auth/logout" method="post" data-auth-action="logout">
        ${Button({ label: "Log out", tone: "secondary" })}
      </form>
    </section>
  </main>`;
}

export default renderProfileScreen;
