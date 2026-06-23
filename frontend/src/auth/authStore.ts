import { create } from "zustand";
import type { Role } from "./rbac";

export interface SessionUser {
  name: string;
  email: string;
  role: Role;
  tenant: string;
  provider: string;
}

const KEY = "dept-canvas-session";

function loadSession(): SessionUser | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: SessionUser | null;
  signIn: (provider: string) => void;
  signOut: () => void;
  setRole: (role: Role) => void;
}

// Mock SSO session for local dev. In production the edge runs OIDC/SAML and issues a
// scoped token; the frontend never holds long-lived credentials.
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: loadSession(),
  signIn: (provider) => {
    const user: SessionUser = {
      name: "Gonzalo Carrillo",
      email: "gonzalo.carrillo@deptagency.com",
      role: "tenant_admin",
      tenant: "DEPT",
      provider,
    };
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    set({ user });
  },
  signOut: () => {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ user: null });
  },
  setRole: (role) => {
    const u = get().user;
    if (!u) return;
    const user = { ...u, role };
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    set({ user });
  },
}));
