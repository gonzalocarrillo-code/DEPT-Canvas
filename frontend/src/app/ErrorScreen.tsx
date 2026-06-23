import { useRouteError, useNavigate } from "react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/ui/button";

export function ErrorScreen() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred.";

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" className="mt-5" onClick={() => navigate("/")}>
          Back to projects
        </Button>
      </div>
    </div>
  );
}
