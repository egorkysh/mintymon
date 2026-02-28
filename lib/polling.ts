/** Default polling intervals in milliseconds for dashboard data fetching */
export const defaultPollingIntervals = {
  deployments: 60_000,
  latency: 30_000,
  database: 120_000,
  alerts: 30_000,
  overview: 30_000,
} as const;

export type PollingKey = keyof typeof defaultPollingIntervals;

const STORAGE_KEY = 'mintymon-polling-intervals';

export function getPollingIntervals(): Record<PollingKey, number> {
  if (typeof window === 'undefined') return { ...defaultPollingIntervals };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultPollingIntervals, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return { ...defaultPollingIntervals };
}

export function setPollingInterval(key: PollingKey, ms: number) {
  const current = getPollingIntervals();
  current[key] = ms;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}
