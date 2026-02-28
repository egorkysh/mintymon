import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  defaultPollingIntervals,
  getPollingIntervals,
  setPollingInterval,
} from '../polling';

describe('defaultPollingIntervals', () => {
  it('has the expected keys and values', () => {
    expect(defaultPollingIntervals).toEqual({
      deployments: 60_000,
      latency: 30_000,
      database: 120_000,
      alerts: 30_000,
      overview: 30_000,
    });
  });
});

describe('getPollingIntervals', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error -- deliberately removing window for SSR tests
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    vi.restoreAllMocks();
  });

  it('returns a copy of defaults when window is undefined (SSR)', () => {
    // @ts-expect-error -- deliberately removing window for SSR simulation
    delete globalThis.window;

    const result = getPollingIntervals();
    expect(result).toEqual(defaultPollingIntervals);
    expect(result).not.toBe(defaultPollingIntervals);
  });

  it('returns defaults when localStorage has no stored value', () => {
    const mockStorage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() };
    globalThis.window = globalThis.window ?? ({} as Window & typeof globalThis);
    vi.stubGlobal('localStorage', mockStorage);

    const result = getPollingIntervals();
    expect(result).toEqual(defaultPollingIntervals);
    expect(mockStorage.getItem).toHaveBeenCalledWith('mintymon-polling-intervals');
  });

  it('merges stored values over defaults', () => {
    const overrides = { deployments: 5000, alerts: 10000 };
    const mockStorage = { getItem: vi.fn().mockReturnValue(JSON.stringify(overrides)), setItem: vi.fn() };
    globalThis.window = globalThis.window ?? ({} as Window & typeof globalThis);
    vi.stubGlobal('localStorage', mockStorage);

    const result = getPollingIntervals();
    expect(result).toEqual({
      ...defaultPollingIntervals,
      deployments: 5000,
      alerts: 10000,
    });
  });

  it('returns defaults when localStorage contains corrupt JSON', () => {
    const mockStorage = { getItem: vi.fn().mockReturnValue('not-valid-json{{{'), setItem: vi.fn() };
    globalThis.window = globalThis.window ?? ({} as Window & typeof globalThis);
    vi.stubGlobal('localStorage', mockStorage);

    const result = getPollingIntervals();
    expect(result).toEqual(defaultPollingIntervals);
  });

  it('returns defaults when localStorage.getItem throws', () => {
    const mockStorage = {
      getItem: vi.fn().mockImplementation(() => { throw new Error('SecurityError'); }),
      setItem: vi.fn(),
    };
    globalThis.window = globalThis.window ?? ({} as Window & typeof globalThis);
    vi.stubGlobal('localStorage', mockStorage);

    const result = getPollingIntervals();
    expect(result).toEqual(defaultPollingIntervals);
  });
});

describe('setPollingInterval', () => {
  let mockStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStorage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() };
    globalThis.window = globalThis.window ?? ({} as Window & typeof globalThis);
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores the updated interval in localStorage', () => {
    setPollingInterval('deployments', 5000);

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'mintymon-polling-intervals',
      expect.any(String),
    );

    const storedValue = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(storedValue.deployments).toBe(5000);
    expect(storedValue.latency).toBe(defaultPollingIntervals.latency);
  });

  it('persists through a subsequent getPollingIntervals call', () => {
    const store = new Map<string, string>();
    mockStorage.getItem.mockImplementation((key: string) => store.get(key) ?? null);
    mockStorage.setItem.mockImplementation((key: string, value: string) => { store.set(key, value); });

    setPollingInterval('latency', 99_000);

    const result = getPollingIntervals();
    expect(result.latency).toBe(99_000);
    expect(result.deployments).toBe(defaultPollingIntervals.deployments);
  });
});
