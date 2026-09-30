import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => count < 2 && (!error?.status || error.status >= 500 || error.status === 0),
      refetchOnWindowFocus: true,
      staleTime: 10000,
    },
    mutations: { retry: 0 },
  },
});
