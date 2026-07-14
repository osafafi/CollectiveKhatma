import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useDu3aAcknowledgement,
  useLastReadPage,
  useReadingScale,
  useRememberedMemberId,
} from '@/app/persistence';

describe('React browser-persistence hooks', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.readingScale;
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads, updates, and clears the remembered member identity', () => {
    localStorage.setItem('khatma.memberId', 'member-1');
    const { result } = renderHook(() => useRememberedMemberId());

    expect(result.current[0]).toBe('member-1');

    act(() => result.current[1]('member-2'));
    expect(result.current[0]).toBe('member-2');
    expect(localStorage.getItem('khatma.memberId')).toBe('member-2');

    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem('khatma.memberId')).toBeNull();
  });

  it('falls back from an invalid reading scale, then applies and persists updates', () => {
    localStorage.setItem('khatma.readingScale', '6');
    const { result } = renderHook(() => useReadingScale());

    expect(result.current[0]).toBe(3);
    expect(document.documentElement).toHaveAttribute('data-reading-scale', '3');
    expect(localStorage.getItem('khatma.readingScale')).toBe('3');

    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(document.documentElement).toHaveAttribute('data-reading-scale', '5');
    expect(localStorage.getItem('khatma.readingScale')).toBe('5');
  });

  it('resumes only valid Quran pages and persists browse navigation', () => {
    localStorage.setItem('khatma.lastReadPage', '604');
    const valid = renderHook(() => useLastReadPage());

    expect(valid.result.current[0]).toBe(604);
    act(() => valid.result.current[1](20));
    expect(valid.result.current[0]).toBe(20);
    expect(localStorage.getItem('khatma.lastReadPage')).toBe('20');
    valid.unmount();

    localStorage.setItem('khatma.lastReadPage', '20.5');
    const invalid = renderHook(() => useLastReadPage());
    expect(invalid.result.current[0]).toBe(1);
  });

  it('uses the exact per-khatma acknowledgement key and only accepts value 1', () => {
    localStorage.setItem('khatma.du3aAck.khatma-1', 'true');
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useDu3aAcknowledgement(id),
      { initialProps: { id: 'khatma-1' } },
    );

    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('khatma.du3aAck.khatma-1')).toBe('1');

    localStorage.setItem('khatma.du3aAck.khatma-2', '1');
    rerender({ id: 'khatma-2' });
    expect(result.current[0]).toBe(true);
  });

  it('keeps all four hooks usable when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    const { result } = renderHook(() => ({
      identity: useRememberedMemberId(),
      scale: useReadingScale(),
      page: useLastReadPage(),
      acknowledgement: useDu3aAcknowledgement('blocked-khatma'),
    }));

    expect(result.current.identity[0]).toBeNull();
    expect(result.current.scale[0]).toBe(3);
    expect(result.current.page[0]).toBe(1);
    expect(result.current.acknowledgement[0]).toBe(false);

    act(() => {
      result.current.identity[1]('member-offline');
      result.current.scale[1](4);
      result.current.page[1](100);
      result.current.acknowledgement[1]();
    });

    expect(result.current.identity[0]).toBe('member-offline');
    expect(result.current.scale[0]).toBe(4);
    expect(result.current.page[0]).toBe(100);
    expect(result.current.acknowledgement[0]).toBe(true);
  });
});
