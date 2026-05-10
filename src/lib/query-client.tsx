"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Singleton QueryClient factory.
 * staleTime 30 s   → cached data considered fresh for 30 s after fetch
 * retry 2          → retry failed requests twice before showing an error
 * refetchOnWindowFocus → re-fetch when user switches back to the tab
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures the QueryClient is created once per component tree
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
