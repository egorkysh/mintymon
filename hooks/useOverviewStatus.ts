'use client';

import { useQuery } from '@tanstack/react-query';
import { getPollingIntervals } from '@/lib/polling';

export function useOverviewStatus() {
  const vercel = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const res = await fetch('/api/metrics/vercel');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: getPollingIntervals().overview,
  });

  const axiom = useQuery({
    queryKey: ['axiom-snapshot'],
    queryFn: async () => {
      const res = await fetch('/api/metrics/axiom');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: getPollingIntervals().overview,
  });

  const neon = useQuery({
    queryKey: ['database'],
    queryFn: async () => {
      const res = await fetch('/api/metrics/neon');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: getPollingIntervals().overview,
  });

  return { vercel, axiom, neon };
}
