import { describe, it, expect } from 'vitest';
import { cn, formatBytes } from '../utils';

describe('cn', () => {
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('merges multiple non-conflicting classes', () => {
    expect(cn('px-4', 'py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
  });

  it('handles conditional/falsy values via clsx', () => {
    expect(cn('base', false && 'hidden', undefined, null, 'end')).toBe(
      'base end',
    );
  });

  it('handles object syntax from clsx', () => {
    expect(cn({ 'font-bold': true, 'text-red-500': false })).toBe('font-bold');
  });

  it('handles array inputs', () => {
    expect(cn(['px-2', 'py-2'])).toBe('px-2 py-2');
  });

  it('merges conflicting color utilities', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('formatBytes', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats values in bytes (< 1 KB)', () => {
    expect(formatBytes(1)).toBe('1.0 B');
    expect(formatBytes(512)).toBe('512.0 B');
    expect(formatBytes(1023)).toBe('1023.0 B');
  });

  it('formats exact 1 KB boundary', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10240)).toBe('10.0 KB');
  });

  it('formats exact 1 MB boundary', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('formats exact 1 GB boundary', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB');
  });

  it('formats exact 1 TB boundary', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.0 TB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3.0 TB');
  });
});
