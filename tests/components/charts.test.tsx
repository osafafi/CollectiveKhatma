import type { ReactElement } from 'react';
import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import {
  DonutChart,
  QuranPageGrid,
  SegmentBar,
  type BarSegment,
} from '@/components/charts';
import { strings } from '@/content/strings.ar';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { tokens } from '@/theme/muiTheme';

function renderThemed(ui: ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

/** Legacy geometry: viewBox 96, stroke 10 → ring radius 41. */
const RING_RADIUS = 48 - 10 / 2 - 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

describe('DonutChart', () => {
  it('exposes the percentage in Arabic-Indic digits as the accessible name', () => {
    renderThemed(<DonutChart percent={57} />);
    const donut = screen.getByRole('img', { name: '٥٧٪' });
    expect(donut).toBeInTheDocument();
    // The visible hero number twins the accessible name and stays hidden from AT.
    expect(screen.getByText('٥٧٪')).toHaveAttribute('aria-hidden', 'true');
  });

  it('clamps out-of-range percentages to the 0–100 determinate range', () => {
    renderThemed(<DonutChart percent={250} />);
    expect(screen.getByRole('img', { name: '١٠٠٪' })).toBeInTheDocument();

    renderThemed(<DonutChart percent={-10} />);
    expect(screen.getByRole('img', { name: '٠٪' })).toBeInTheDocument();
  });

  it('draws only the divider-colored track at zero percent', () => {
    const { container } = renderThemed(<DonutChart percent={0} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0]).toHaveAttribute('stroke', tokens.color.border);
  });

  it('draws a primary fill arc proportional to the percentage', () => {
    const { container } = renderThemed(<DonutChart percent={57} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);

    const [track, fill] = circles;
    expect(track).toHaveAttribute('stroke', tokens.color.border);
    expect(fill).toHaveAttribute('stroke', tokens.color.primary);
    expect(fill).toHaveAttribute(
      'stroke-dasharray',
      `${(CIRCUMFERENCE * 57) / 100} ${CIRCUMFERENCE}`,
    );
    expect(fill).toHaveAttribute('transform', 'rotate(-90 48 48)');
  });

  it('renders at the legacy 112px default and accepts the 88px metrics size', () => {
    renderThemed(<DonutChart percent={40} />);
    expect(screen.getByRole('img', { name: '٤٠٪' })).toHaveAttribute('width', '112');

    renderThemed(<DonutChart percent={41} size={88} />);
    expect(screen.getByRole('img', { name: '٤١٪' })).toHaveAttribute('width', '88');
  });
});

const SEGMENTS: readonly BarSegment[] = [
  { value: 342, color: 'primary', label: 'قُرئت' },
  { value: 48, color: 'accent', label: 'قيد القراءة' },
  { value: 214, color: 'neutral', label: 'متبقية' },
];

/** The bar strip is the only aria-hidden div (legend dots are spans). */
function barOf(container: HTMLElement): HTMLElement {
  const bar = container.querySelector('div[aria-hidden="true"]');
  if (!(bar instanceof HTMLElement)) throw new Error('segment bar not rendered');
  return bar;
}

describe('SegmentBar', () => {
  it('writes every count in the legend with Arabic-Indic digits', () => {
    renderThemed(<SegmentBar segments={SEGMENTS} />);
    expect(screen.getByText('قُرئت: ٣٤٢')).toBeInTheDocument();
    expect(screen.getByText('قيد القراءة: ٤٨')).toBeInTheDocument();
    expect(screen.getByText('متبقية: ٢١٤')).toBeInTheDocument();
  });

  it('sizes visible segments by value and resolves semantic palette colors', () => {
    const { container } = renderThemed(<SegmentBar segments={SEGMENTS} />);
    const fills = barOf(container).children;
    expect(fills).toHaveLength(3);
    expect(fills[0]).toHaveStyle({
      flexGrow: '342',
      backgroundColor: tokens.color.primary,
    });
    expect(fills[1]).toHaveStyle({
      flexGrow: '48',
      backgroundColor: tokens.color.accent,
    });
    expect(fills[2]).toHaveStyle({
      flexGrow: '214',
      backgroundColor: tokens.color.border,
    });
  });

  it('hides zero-value segments from the bar but keeps them in the legend', () => {
    const withEmpty: BarSegment[] = [
      { value: 342, color: 'primary', label: 'قُرئت' },
      { value: 0, color: 'accent', label: 'قيد القراءة' },
      { value: 214, color: 'neutral', label: 'متبقية' },
    ];
    const { container } = renderThemed(<SegmentBar segments={withEmpty} />);
    expect(barOf(container).children).toHaveLength(2);
    expect(screen.getByText('قيد القراءة: ٠')).toBeInTheDocument();
  });

  it('renders a full neutral track when every value is zero', () => {
    const empty: BarSegment[] = [
      { value: 0, color: 'primary', label: 'قُرئت' },
      { value: 0, color: 'neutral', label: 'متبقية' },
    ];
    const { container } = renderThemed(<SegmentBar segments={empty} />);
    const fills = barOf(container).children;
    expect(fills).toHaveLength(1);
    expect(fills[0]).toHaveStyle({ backgroundColor: tokens.color.border });
    expect(screen.getByText('قُرئت: ٠')).toBeInTheDocument();
  });
});

const GRID_KHATMA: Khatma = {
  id: 'grid',
  seriesId: 'grid-series',
  seriesName: 'أهل القرآن',
  seriesNumber: 1,
  totalPages: 6,
  scope: { kind: 'range', fromPage: 1, toPage: 6 },
  memberIds: ['p1', 'p2'],
  capacities: {
    p1: { pages: 2, surahs: 0, juz: 0 },
    p2: { pages: 2, surahs: 0, juz: 0 },
  },
  duaReciterId: 'p1',
  status: 'active',
  remainingPages: [5, 6],
  roundCount: 2,
  createdAt: 1,
};

const GRID_ASSIGNMENTS: Assignment[] = [
  {
    memberId: 'p1',
    rounds: [
      {
        round: 1,
        date: '2026-07-14',
        pages: [1, 2],
        loosePages: [1, 2],
        redistributedPages: [],
      },
    ],
    doneByRound: { 1: 10 },
    missedStreak: 0,
  },
  {
    memberId: 'p2',
    rounds: [
      {
        round: 2,
        date: '2026-07-15',
        pages: [3, 4],
        loosePages: [3, 4],
        redistributedPages: [],
      },
    ],
    doneByRound: {},
    missedStreak: 0,
  },
];

const GRID_ROSTER: Person[] = [
  {
    id: 'p1',
    name: 'Amina',
    emoji: '🌷',
    completedPages: [],
    pagesPerDay: 2,
    enabled: true,
    createdAt: 1,
  },
  {
    id: 'p2',
    name: 'Maryam',
    completedPages: [],
    pagesPerDay: 2,
    enabled: true,
    createdAt: 2,
  },
];

describe('QuranPageGrid', () => {
  it('stays collapsed until requested and reveals the three page states', () => {
    renderThemed(
      <QuranPageGrid
        khatma={GRID_KHATMA}
        assignments={GRID_ASSIGNMENTS}
        roster={GRID_ROSTER}
      />,
    );

    expect(screen.queryByRole('grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: strings.admin.pageMapHeading }));

    const grid = screen.getByRole('grid');
    expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(6);
    expect(grid.querySelector('[data-page="1"]')).toHaveAttribute(
      'data-page-state',
      'done',
    );
    expect(grid.querySelector('[data-page="3"]')).toHaveAttribute(
      'data-page-state',
      'assigned',
    );
    expect(grid.querySelector('[data-page="5"]')).toHaveAttribute(
      'data-page-state',
      'remaining',
    );
  });

  it('shows chosen emoji or initials while preserving uniform state colors', () => {
    const bothDone: Assignment[] = [
      GRID_ASSIGNMENTS[0]!,
      { ...GRID_ASSIGNMENTS[1]!, doneByRound: { 2: 20 } },
    ];
    renderThemed(
      <QuranPageGrid khatma={GRID_KHATMA} assignments={bothDone} roster={GRID_ROSTER} />,
    );
    fireEvent.click(screen.getByRole('button', { name: strings.admin.pageMapHeading }));
    const grid = screen.getByRole('grid');
    const aminaPage = grid.querySelector('[data-page="1"]') as HTMLElement;
    const maryamPage = grid.querySelector('[data-page="3"]') as HTMLElement;

    expect(aminaPage).toHaveAttribute('data-page-state', 'done');
    expect(maryamPage).toHaveAttribute('data-page-state', 'done');
    expect(aminaPage.querySelector('[data-reader-avatar]')).toHaveAttribute(
      'data-reader-avatar',
      '🌷',
    );
    expect(maryamPage.querySelector('[data-reader-avatar]')).toHaveAttribute(
      'data-reader-avatar',
      'M',
    );
    expect(maryamPage.querySelector('[data-reader-avatar]')).toHaveAttribute(
      'data-avatar-source',
      'initials',
    );
    expect(getComputedStyle(aminaPage).backgroundColor).toBe(
      getComputedStyle(maryamPage).backgroundColor,
    );
  });

  it('moves the focus wave and details while dragging after a long press', () => {
    renderThemed(
      <QuranPageGrid
        khatma={GRID_KHATMA}
        assignments={GRID_ASSIGNMENTS}
        roster={GRID_ROSTER}
        neighborCount={2}
        longPressMs={100}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: strings.admin.pageMapHeading }));
    const grid = screen.getByRole('grid');
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 300,
      top: 0,
      bottom: 300,
      width: 300,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const page = (number: number) =>
      grid.querySelector(`[data-page="${number}"]`) as HTMLElement;
    const activeCardText = () => [
      grid.querySelector('[data-page-header]')?.textContent,
      grid.querySelector('[data-page-number]')?.textContent,
    ];

    vi.useFakeTimers();
    try {
      expect(page(3).querySelector('[data-reader-avatar]')).toHaveTextContent('M');
      fireEvent.pointerDown(page(3), {
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX: 40,
        clientY: 40,
      });
      act(() => vi.advanceTimersByTime(100));

      expect(page(3)).toHaveAttribute('data-active', 'true');
      expect(page(3).querySelector('[data-reader-avatar]')).toBeNull();
      expect(page(2)).not.toHaveAttribute('data-scale', '1.000');
      expect(page(1)).not.toHaveAttribute('data-scale', '1.000');
      expect(page(6)).toHaveAttribute('data-scale', '1.000');
      expect(activeCardText()).toEqual(['Maryam', '٣']);

      // Row 0, column 3 — page 4. The card's 12px pad insets the content box to
      // 12..288, so the 20 columns are 13.8px wide and are counted from the
      // right edge in RTL: 288 - 240 = 48px lands in column 3.
      fireEvent.pointerMove(grid, {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 240,
        clientY: 16,
      });
      expect(page(4)).toHaveAttribute('data-active', 'true');
      expect(activeCardText()).toEqual(['Maryam', '٤']);

      fireEvent.pointerUp(grid, { pointerId: 1, pointerType: 'touch' });
      expect(page(3)).not.toHaveAttribute('data-active');
      expect(page(4)).not.toHaveAttribute('data-active');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a tap and still cancels before activation so a swipe can scroll', () => {
    renderThemed(
      <QuranPageGrid
        khatma={GRID_KHATMA}
        assignments={GRID_ASSIGNMENTS}
        roster={GRID_ROSTER}
        longPressMs={100}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: strings.admin.pageMapHeading }));
    const grid = screen.getByRole('grid');
    const page3 = grid.querySelector('[data-page="3"]') as HTMLElement;

    fireEvent.focus(grid);
    expect(page3).not.toHaveAttribute('data-active');

    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(page3, {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 40,
        clientY: 40,
      });
      fireEvent.pointerUp(grid, { pointerId: 1, pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(100));
      expect(page3).not.toHaveAttribute('data-active');

      fireEvent.pointerDown(page3, {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 40,
        clientY: 40,
      });
      fireEvent.pointerMove(grid, {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 40,
        clientY: 60,
      });
      act(() => vi.advanceTimersByTime(100));

      expect(page3).not.toHaveAttribute('data-active');
    } finally {
      vi.useRealTimers();
    }
  });
});
