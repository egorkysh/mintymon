'use client';

import { useQuery } from '@tanstack/react-query';
import { getPollingIntervals } from '@/lib/polling';

export function useDeployments() {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const res = await fetch('/api/metrics/vercel');
      if (!res.ok) throw new Error('Failed to fetch deployments');
      return res.json();
    },
    refetchInterval: getPollingIntervals().deployments,
  });
}
