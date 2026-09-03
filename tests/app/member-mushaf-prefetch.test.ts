import { describe, expect, it } from 'vitest';
import {
  createMushafPrefetch,
  mushafPrefetchOrder,
  type MushafPrefetchEnvironment,
} from '@/app/member/install/mushafPrefetch';
import { quranMetadataUrls, quranPageUrl } from '@/content/quran/loader';

const TOTAL_FILES = 604 + quranMetadataUrls.length;

interface Harness {
  environment: MushafPrefetchEnvironment;
  warmed: string[];
  idle: (() => void)[];
}

function harness(overrides: Partial<MushafPrefetchEnvironment> = {}): Harness {
  const warmed: string[] = [];
  const idle: (() => void)[] = [];

  return {
    warmed,
    idle,
    environment: {
      isControlled: () => true,
      isOnline: () => true,
      savesData: () => false,
      warm: async (url) => {
        warmed.push(url);
      },
      scheduleIdle: (run) => {
        idle.push(run);
      },
      ...overrides,
    },
  };
}

/** Run one scheduled slice and let its fetches settle. */
async function runSlice(idle: (() => void)[]): Promise<void> {
  idle.shift()?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Run slices until the sweep parks itself or finishes. */
async function drain(idle: (() => void)[]): Promise<void> {
  for (let slice = 0; idle.length > 0 && slice < 1000; slice += 1) {
    await runSlice(idle);
  }
}

describe('mushaf prefetch order', () => {
  it('reads the given pages first, then the rest of the mushaf ascending', () => {
    expect(mushafPrefetchOrder([3, 1], 5)).toEqual([3, 1, 2, 4, 5]);
  });

  it('drops repeats and pages outside the mushaf, so an assigned chunk passes straight through', () => {
    expect(mushafPrefetchOrder([3, 3, 0, 605, 2.5], 5)).toEqual([3, 1, 2, 4, 5]);
    expect(mushafPrefetchOrder()).toHaveLength(604);
  });
});

describe('mushaf prefetch sweep', () => {
  it('warms the metadata and every page exactly once', async () => {
    const { environment, warmed, idle } = harness();

    createMushafPrefetch(environment).start();
    await drain(idle);

    expect(warmed.slice(0, quranMetadataUrls.length)).toEqual([...quranMetadataUrls]);
    expect(warmed).toHaveLength(TOTAL_FILES);
    expect(new Set(warmed).size).toBe(TOTAL_FILES);
  });

  it('does nothing until a worker controls the page, so a first visit spends no data', async () => {
    const { environment, warmed, idle } = harness({ isControlled: () => false });

    createMushafPrefetch(environment).start();
    await drain(idle);

    expect(idle).toHaveLength(0);
    expect(warmed).toEqual([]);
  });

  it('stands down for Data Saver and for a browser that is already offline', async () => {
    const saver = harness({ savesData: () => true });
    const offline = harness({ isOnline: () => false });

    createMushafPrefetch(saver.environment).start();
    createMushafPrefetch(offline.environment).start();
    await drain(saver.idle);
    await drain(offline.idle);

    expect(saver.warmed).toEqual([]);
    expect(offline.warmed).toEqual([]);
  });

  it('pulls the assigned chunk to the front of a sweep already under way', async () => {
    const { environment, warmed, idle } = harness();
    const prefetch = createMushafPrefetch(environment);

    prefetch.start();
    await runSlice(idle);
    const beforeSeeding = warmed.length;

    prefetch.start([300, 301]);
    await runSlice(idle);

    expect(warmed.slice(beforeSeeding, beforeSeeding + 2)).toEqual([
      quranPageUrl(300),
      quranPageUrl(301),
    ]);

    await drain(idle);
    expect(new Set(warmed).size).toBe(TOTAL_FILES);
  });

  it('parks the queue when the connection drops and resumes it without refetching', async () => {
    let online = true;
    const { environment, warmed, idle } = harness({ isOnline: () => online });
    const prefetch = createMushafPrefetch(environment);

    prefetch.start();
    await runSlice(idle);
    const beforeOffline = warmed.length;
    expect(beforeOffline).toBeGreaterThan(0);

    online = false;
    await runSlice(idle);

    expect(warmed).toHaveLength(beforeOffline);
    expect(idle).toHaveLength(0);

    online = true;
    prefetch.start();
    await drain(idle);

    expect(warmed).toHaveLength(TOTAL_FILES);
    expect(new Set(warmed).size).toBe(TOTAL_FILES);
  });
});
