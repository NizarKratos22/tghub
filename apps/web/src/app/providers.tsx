'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErrorReporter } from '@/components/ErrorReporter';
import { LiveUpdates } from '@/features/realtime/LiveUpdates';
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider';
import { ApiError } from '@/lib/api/client';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Client errors (401, 404, 422) won't fix themselves on retry.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <RealtimeProvider>
        {children}
        <LiveUpdates />
        <ErrorReporter />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
