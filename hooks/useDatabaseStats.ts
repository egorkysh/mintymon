'use client';

import { useQuery } from '@tanstack/react-query';
import { getPollingIntervals } from '@/lib/polling';

export function useDatabaseStats() {
  return useQuery({
    queryKey: ['database'],
    queryFn: async () => {
      const res = await fetch('/api/metrics/neon');
      if (!res.ok) throw new Error('Failed to fetch database stats');
      return res.json();
    },
    refetchInterval: getPollingIntervals().database,
  });
}
