import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { AppHashRouter } from '@/app/routing/AppHashRouter';
import { MemberShell } from '@/app/member/MemberShell';
import { AdminShell } from '@/app/admin/AdminShell';
import {
  appNavLayout,
  appShellContentSx,
  appShellFrameSx,
} from '@/components/navigation/layoutContracts';
import { strings } from '@/content/strings.ar';

/** Mirror the hash-routing tests: drive HashRouter via the real location hash. */
function setHash(hash: string): void {
  window.history.replaceState(null, '', `/${hash}`);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

/** Render a shell in isolation under the real MUI RTL theme + hash router. */
function renderShell(shell: (content: ReactNode) => ReactNode, hash = '') {
  if (hash) setHash(hash);
  return render(
    <AppThemeProvider>
      <AppHashRouter>
        {shell(<div data-testid="content">route content</div>)}
      </AppHashRouter>
    </AppThemeProvider>,
  );
}

const renderMember = (hash = '') =>
  renderShell((content) => <MemberShell>{content}</MemberShell>, hash);
const renderAdmin = (hash = '') =>
  renderShell((content) => <AdminShell>{content}</AdminShell>, hash);

describe('Member shell navigation (RM-310)', () => {
  it('frames route content in the single main landmark', () => {
    renderMember();
    const main = screen.getByRole('main');
    expect(within(main).getByTestId('content')).toBeInTheDocument();
  });

  it('renders the four member tabs with Arabic labels and hash links', () => {
    renderMember();
    const nav = screen.getByRole('navigation', { name: strings.common.appName });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);

    const hrefs: Array<[string, string]> = [
      [strings.nav.khatmas, '#/khatmas'],
      [strings.nav.quran, '#/quran'],
      [strings.nav.personal, '#/personal'],
      [strings.nav.settings, '#/settings'],
    ];
    for (const [label, href] of hrefs) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  it('hosts every tab icon as an aria-hidden mask span (override-aware since RM-330)', () => {
    const { container } = renderMember();
    const icons = container.querySelectorAll('nav .icon-mask');
    expect(icons).toHaveLength(4);
    icons.forEach((node) => expect(node).toHaveAttribute('aria-hidden', 'true'));
  });

  it('marks only the active tab with aria-current on the default route', () => {
    renderMember();
    const nav = screen.getByRole('navigation', { name: strings.common.appName });
    expect(within(nav).getByRole('link', { name: strings.nav.khatmas })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: strings.nav.quran }),
    ).not.toHaveAttribute('aria-current');
  });

  it('follows the logical RTL navigation order by keyboard', async () => {
    const user = userEvent.setup();
    renderMember();
    const nav = screen.getByRole('navigation', { name: strings.common.appName });

    for (const label of [
      strings.nav.khatmas,
      strings.nav.quran,
      strings.nav.personal,
      strings.nav.settings,
    ]) {
      await user.tab();
      expect(within(nav).getByRole('link', { name: label })).toHaveFocus();
    }
  });

  it('keeps the khatmas tab active across its nested khatma and reader routes', () => {
    renderMember('#/khatma/k1/read');
    const nav = screen.getByRole('navigation', { name: strings.common.appName });
    expect(within(nav).getByRole('link', { name: strings.nav.khatmas })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: strings.nav.settings }),
    ).not.toHaveAttribute('aria-current');
  });
});

describe('Responsive shell contracts (RM-650)', () => {
  it('clears the mobile tab bar and reserves the RTL desktop rail', () => {
    expect(appShellFrameSx.paddingInlineStart).toEqual({ lg: '96px' });
    expect(appShellContentSx).toMatchObject({
      width: '100%',
      pb: { xs: 28, lg: 8 },
    });
    expect(appNavLayout).toEqual({
      mobile: {
        insetInline: 0,
        bottom: 0,
        borderTopWidth: '1px',
        maxListWidth: 576,
        flexDirection: 'row',
        minTargetHeight: '3.5rem',
      },
      desktop: {
        insetInlineStart: 0,
        top: 0,
        height: '100%',
        railWidth: 96,
        flexDirection: 'column',
      },
    });
  });
});

describe('Admin shell navigation (RM-310)', () => {
  it('renders the four admin tabs with Arabic labels, hash links, and active state', () => {
    renderAdmin('#/roster');
    const nav = screen.getByRole('navigation', { name: strings.admin.heading });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);

    const hrefs: Array<[string, string]> = [
      [strings.admin.navHome, '#/home'],
      [strings.admin.navRoster, '#/roster'],
      [strings.admin.navKhatmas, '#/khatmas'],
      [strings.admin.navSettings, '#/settings'],
    ];
    for (const [label, href] of hrefs) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }

    expect(
      within(nav).getByRole('link', { name: strings.admin.navRoster }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the khatmas tab active on the khatma detail route', () => {
    renderAdmin('#/khatmas/k9');
    const nav = screen.getByRole('navigation', { name: strings.admin.heading });
    expect(
      within(nav).getByRole('link', { name: strings.admin.navKhatmas }),
    ).toHaveAttribute('aria-current', 'page');
  });
});
