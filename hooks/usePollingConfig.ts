'use client';

import { useState, useCallback } from 'react';
import { getPollingIntervals, setPollingInterval, type PollingKey } from '@/lib/polling';

export function usePollingConfig() {
  const [intervals, setIntervals] = useState(getPollingIntervals);

  const update = useCallback((key: PollingKey, ms: number) => {
    setPollingInterval(key, ms);
    setIntervals(getPollingIntervals());
  }, []);

  return { intervals, update };
}
