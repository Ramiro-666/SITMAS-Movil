import { QueryClient } from '@tanstack/react-query';

// TanStack: una única caché compartida por todas las pantallas.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1 },
    mutations: { retry: false, networkMode: 'always', gcTime: 0 },
  },
});
