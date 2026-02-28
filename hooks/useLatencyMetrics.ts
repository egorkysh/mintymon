'use client';

import { useQuery } from '@tanstack/react-query';
import { useTimeRange } from '@/components/providers/time-range-provider';
import { getPollingIntervals } from '@/lib/polling';

export function useLatencyMetrics(metricKey: string) {
  const { from, to } = useTimeRange();

  return useQuery({
    queryKey: ['timeseries', metricKey, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        key: metricKey,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/metrics/timeseries?${params}`);
      if (!res.ok) throw new Error('Failed to fetch timeseries');
      return res.json();
    },
    refetchInterval: getPollingIntervals().latency,
  });
}
