import { escapeHtml } from "../design/Button.js";
import {
  capabilitiesForRole,
  hasCapabilityForRole,
  RBAC_ROLES,
  ROLE_LABELS,
  type Capability,
  type Role,
} from "../auth/rbac.js";

export {
  capabilitiesForRole,
  RBAC_ROLES,
  ROLE_LABELS,
  type Capability,
  type Role,
} from "../auth/rbac.js";

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
}

export interface UserRoleScreenState {
  readonly currentUserRole: Role;
  readonly currentUserCapabilities: readonly Capability[];
  readonly members: readonly TeamMember[];
}

export const defaultUserRoleState: UserRoleScreenState = {
  currentUserRole: "tenant_admin",
  currentUserCapabilities: capabilitiesForRole("tenant_admin"),
  members: [
    {
      id: "user-1",
      name: "Ari Moore",
      email: "ari@example.com",
      role: "tenant_admin",
    },
    {
      id: "user-2",
      name: "Maya Chen",
      email: "maya@example.com",
      role: "brand_owner",
    },
    {
      id: "user-3",
      name: "Noah Ruiz",
      email: "noah@example.com",
      role: "viewer",
    },
  ],
};

export function hasCapability(
  capabilities: readonly Capability[],
  capability: Capability,
): boolean {
  return capabilities.includes(capability);
}

export function canTriggerCreatorAction(state: UserRoleScreenState): boolean {
  return hasCapability(state.currentUserCapabilities, "scene:create") &&
    hasCapabilityForRole(state.currentUserRole, "scene:create");
}

function renderRoleOptions(selectedRole: Role): string {
  return RBAC_ROLES.map((role) => {
    const selected = role === selectedRole ? " selected" : "";
    return `<option value="${role}"${selected}>${ROLE_LABELS[role]}</option>`;
  }).join("");
}

export function renderUserRoleScreen(
  state: UserRoleScreenState = defaultUserRoleState,
): string {
  const canCreate = canTriggerCreatorAction(state);
  const createDisabled = canCreate ? "" : " disabled";
  const members = state.members
    .map(
      (member) => `<tr data-user-id="${escapeHtml(member.id)}">
        <td>${escapeHtml(member.name)}</td>
        <td>${escapeHtml(member.email)}</td>
        <td>
          <label>
            <span class="dc-sr-only">Role for ${escapeHtml(member.name)}</span>
            <select name="role-${escapeHtml(member.id)}">${renderRoleOptions(member.role)}</select>
          </label>
        </td>
      </tr>`,
    )
    .join("");
  const roles = RBAC_ROLES.map(
    (role) => `<li data-rbac-role="${role}">${ROLE_LABELS[role]}</li>`,
  ).join("");

  return `<main class="dc-admin-screen" data-screen="user-roles" data-current-role="${state.currentUserRole}">
    <section aria-label="User and role management">
      <p class="dc-kicker">Admin</p>
      <h1>User roles</h1>
      <button class="dc-button dc-button--primary" type="button" data-creator-action="create-project"${createDisabled}>Create project</button>
      <ul class="dc-role-list" aria-label="RBAC roles">${roles}</ul>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>${members}</tbody>
      </table>
    </section>
  </main>`;
}

export default renderUserRoleScreen;
