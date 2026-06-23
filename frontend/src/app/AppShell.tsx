import { Suspense } from "react";
import { Navigate, Outlet } from "react-router";
import { TopBar } from "./TopBar";
import { IconRail } from "./IconRail";
import { CommandMenu } from "./CommandMenu";
import { RouteFallback } from "./RouteFallback";
import { useAuthStore } from "@/auth/authStore";

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandMenu />
    </div>
  );
}
