import { QueryClient } from "@tanstack/react-query";

// -- Client -------------------------------------------------------------------

const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// -- Exports ------------------------------------------------------------------

export { appQueryClient };
