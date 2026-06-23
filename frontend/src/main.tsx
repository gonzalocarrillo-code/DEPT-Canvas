import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Loader2 } from "lucide-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { RouterProvider } from "react-router/dom";
import { queryClient } from "@/lib/queryClient";
import { bootstrapTheme } from "@/lib/theme";
import { router } from "@/router";
import "./index.css";

bootstrapTheme();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <Suspense
          fallback={
            <div className="grid h-screen place-items-center bg-background">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </NuqsAdapter>
    </QueryClientProvider>
  </StrictMode>,
);
