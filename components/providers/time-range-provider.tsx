'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export type TimeRangePreset = '1h' | '6h' | '24h' | '7d' | '30d';

interface TimeRangeContextValue {
  preset: TimeRangePreset;
  setPreset: (preset: TimeRangePreset) => void;
  from: Date;
  to: Date;
}

const presetToMs: Record<TimeRangePreset, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<TimeRangePreset>('24h');

  const now = new Date();
  const from = new Date(now.getTime() - presetToMs[preset]);

  return (
    <TimeRangeContext.Provider value={{ preset, setPreset, from, to: now }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) throw new Error('useTimeRange must be used within TimeRangeProvider');
  return ctx;
}
