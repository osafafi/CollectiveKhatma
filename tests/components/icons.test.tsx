import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ICON_NAMES,
  getIconUrl,
  resetIconOverridesForTests,
  resolveIconOverrides,
  useIconUrl,
} from '@/components/icons';
import { NavIcon } from '@/components/navigation/NavIcon';

afterEach(() => {
  resetIconOverridesForTests();
});

type HeadResponse = Pick<Response, 'ok' | 'headers'>;

/** A found/missing HEAD result with the content-type a real server would send. */
function headResponse(ok: boolean, contentType = 'image/png'): HeadResponse {
  return { ok, headers: new Headers(ok ? { 'content-type': contentType } : {}) };
}

/** A HEAD-probe stub whose per-URL outcomes the test scripts up front. */
function fetchStub(outcome: (url: string) => Promise<HeadResponse>) {
  return vi.fn((input: RequestInfo | URL) =>
    outcome(String(input)),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('Icon override source', () => {
  it('defaults every icon to its bundled SVG under BASE_URL', () => {
    for (const name of ICON_NAMES) {
      expect(getIconUrl(name)).toBe(`/icons/${name}.svg`);
    }
  });

  it('HEAD-probes every icon once and upgrades only found PNGs', async () => {
    const probe = fetchStub((url) =>
      Promise.resolve(headResponse(url.includes('khatmas'))),
    );

    await act(async () => {
      resolveIconOverrides(probe);
    });

    await waitFor(() => expect(getIconUrl('khatmas')).toBe('/icons/khatmas.png'));
    expect(probe).toHaveBeenCalledTimes(ICON_NAMES.length);
    expect(probe).toHaveBeenCalledWith('/icons/khatmas.png', { method: 'HEAD' });
    for (const name of ICON_NAMES) {
      if (name === 'khatmas') continue;
      expect(getIconUrl(name)).toBe(`/icons/${name}.svg`);
    }
  });

  it('ignores the dev-server SPA fallback: 200 text/html is not a PNG', async () => {
    const probe = fetchStub(() => Promise.resolve(headResponse(true, 'text/html')));

    await act(async () => {
      resolveIconOverrides(probe);
    });

    expect(probe).toHaveBeenCalledTimes(ICON_NAMES.length);
    for (const name of ICON_NAMES) {
      expect(getIconUrl(name)).toBe(`/icons/${name}.svg`);
    }
  });

  it('keeps the SVG when the probe rejects (offline / missing file)', async () => {
    const probe = fetchStub(() => Promise.reject(new Error('offline')));

    await act(async () => {
      resolveIconOverrides(probe);
    });

    expect(probe).toHaveBeenCalledTimes(ICON_NAMES.length);
    for (const name of ICON_NAMES) {
      expect(getIconUrl(name)).toBe(`/icons/${name}.svg`);
    }
  });

  it('is idempotent: repeated startup calls never re-probe', async () => {
    const probe = fetchStub(() => Promise.resolve(headResponse(false)));

    await act(async () => {
      resolveIconOverrides(probe);
      resolveIconOverrides(probe);
    });

    expect(probe).toHaveBeenCalledTimes(ICON_NAMES.length);
  });

  it('re-renders subscribed components when an override lands', async () => {
    const resolvers = new Map<string, (res: HeadResponse) => void>();
    const probe = fetchStub(
      (url) => new Promise((resolve) => resolvers.set(url, resolve)),
    );

    function Probe() {
      return <span data-testid="url">{useIconUrl('quran')}</span>;
    }

    render(<Probe />);
    expect(screen.getByTestId('url')).toHaveTextContent('/icons/quran.svg');

    resolveIconOverrides(probe);
    await act(async () => {
      resolvers.get('/icons/quran.png')?.(headResponse(true));
    });

    expect(screen.getByTestId('url')).toHaveTextContent('/icons/quran.png');
  });

  it('NavIcon hosts the chosen URL as an aria-hidden mask span', () => {
    const { container } = render(<NavIcon name="personal" size={24} />);
    const span = container.querySelector('.icon-mask');
    expect(span).not.toBeNull();
    expect(span).toHaveAttribute('aria-hidden', 'true');
    expect(span).toHaveStyle({ width: '24px', height: '24px' });
  });
});
