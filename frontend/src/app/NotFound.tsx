import { useNavigate } from "react-router";
import { Button } from "@/ui/button";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="grid h-full place-items-center px-4 text-center">
      <div>
        <p className="text-meta">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This page doesn’t exist or has moved.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => navigate("/")}>
          Back to projects
        </Button>
      </div>
    </div>
  );
}
