import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { DonutChart, SegmentBar, type BarSegment } from '@/components/charts';
import { tokens } from '@/theme/muiTheme';

function renderThemed(ui: ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

/** Legacy geometry: viewBox 96, stroke 10 → ring radius 41. */
const RING_RADIUS = 48 - 10 / 2 - 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

describe('DonutChart (RM-330)', () => {
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

describe('SegmentBar (RM-330)', () => {
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
