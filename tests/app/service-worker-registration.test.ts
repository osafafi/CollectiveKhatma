import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '@/app/member/install/serviceWorkerRegistration';

function environment(controlled = true) {
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ update });
  const reload = vi.fn();
  const workers = Object.assign(new EventTarget(), {
    controller: controlled ? {} : (null as object | null),
    register,
  });
  const page = Object.assign(new EventTarget(), {
    readyState: 'complete',
    visibilityState: 'visible',
  });
  const browser = Object.assign(new EventTarget(), {
    location: { reload },
    setInterval,
  });
  const navigator = { serviceWorker: workers, onLine: true };
  vi.stubGlobal('navigator', navigator);
  vi.stubGlobal('document', page);
  vi.stubGlobal('window', browser);
  return { update, register, reload, workers, page, browser, navigator };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/CollectiveKhatma/');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('automatic member app updates', () => {
  it('registers under the deployed base without using stale HTTP worker scripts', () => {
    const env = environment();
    registerServiceWorker();
    expect(env.register).toHaveBeenCalledWith('/CollectiveKhatma/sw.js', {
      scope: '/CollectiveKhatma/',
      updateViaCache: 'none',
    });
  });

  it('waits for first paint when called before load, registering only once', () => {
    const env = environment();
    env.page.readyState = 'loading';
    registerServiceWorker();
    expect(env.register).not.toHaveBeenCalled();
    env.browser.dispatchEvent(new Event('load'));
    env.browser.dispatchEvent(new Event('load'));
    expect(env.register).toHaveBeenCalledTimes(1);
  });

  it('reloads once when a new worker replaces the existing controller', () => {
    const env = environment();
    registerServiceWorker();
    env.workers.controller = {};
    env.workers.dispatchEvent(new Event('controllerchange'));
    env.workers.controller = {};
    env.workers.dispatchEvent(new Event('controllerchange'));
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload on first install but recognizes a later update', () => {
    const env = environment(false);
    registerServiceWorker();
    env.workers.controller = {};
    env.workers.dispatchEvent(new Event('controllerchange'));
    env.workers.dispatchEvent(new Event('controllerchange'));
    expect(env.reload).not.toHaveBeenCalled();
    env.workers.controller = {};
    env.workers.dispatchEvent(new Event('controllerchange'));
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  it('checks on normal return and reconnect, throttling duplicate events', async () => {
    const env = environment();
    registerServiceWorker();
    await settle();
    env.page.dispatchEvent(new Event('visibilitychange'));
    env.browser.dispatchEvent(new Event('pageshow'));
    env.browser.dispatchEvent(new Event('online'));
    await settle();
    expect(env.update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    env.browser.dispatchEvent(new Event('online'));
    await settle();
    expect(env.update).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60_000);
    env.browser.dispatchEvent(new Event('pageshow'));
    expect(env.update).toHaveBeenCalledTimes(3);
  });

  it('checks hourly only while visible and online', async () => {
    const env = environment();
    registerServiceWorker();
    await settle();
    env.navigator.onLine = false;
    vi.advanceTimersByTime(3_600_000);
    env.navigator.onLine = true;
    env.page.visibilityState = 'hidden';
    vi.advanceTimersByTime(3_600_000);
    expect(env.update).not.toHaveBeenCalled();
    env.page.visibilityState = 'visible';
    vi.advanceTimersByTime(3_600_000);
    expect(env.update).toHaveBeenCalledTimes(1);
  });

  it('does not overlap checks and recovers after a network failure', async () => {
    const env = environment();
    let reject!: (reason: Error) => void;
    env.update.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    registerServiceWorker();
    await settle();
    env.browser.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(60_000);
    env.browser.dispatchEvent(new Event('online'));
    expect(env.update).toHaveBeenCalledTimes(1);
    reject(new Error('offline'));
    await settle();
    env.browser.dispatchEvent(new Event('online'));
    expect(env.update).toHaveBeenCalledTimes(2);
  });

  it('keeps the app usable if registration fails', async () => {
    const env = environment();
    env.register.mockRejectedValue(new Error('unavailable'));
    registerServiceWorker();
    await settle();
    env.browser.dispatchEvent(new Event('online'));
    expect(env.update).not.toHaveBeenCalled();
    expect(env.reload).not.toHaveBeenCalled();
  });

  it('does not register in development or unsupported browsers', () => {
    const env = environment();
    vi.stubEnv('PROD', false);
    registerServiceWorker();
    expect(env.register).not.toHaveBeenCalled();
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', {});
    expect(registerServiceWorker).not.toThrow();
  });
});
