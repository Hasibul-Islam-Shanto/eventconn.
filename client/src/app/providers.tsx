'use client';
import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
import { DemoProvider } from '@/components/demo-provider';
import { AccessBoundary } from '@/features/auth/access-boundary';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <AccessBoundary>{children}</AccessBoundary>
      </DemoProvider>
    </QueryClientProvider>
  );
}
