import { QueryClient } from "@tanstack/react-query";

// Created at module scope (never inside a component) per TanStack Query v5 guidance.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
