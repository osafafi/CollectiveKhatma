import type { IconName } from '@/ui/shared/icons';

/**
 * Minimal navigation icon (RM-310): a `.icon-mask` span (retained global style,
 * RM-210 §8) painted with `currentColor`, so it inherits the active/inactive tab
 * color set by {@link AppNav}. Only the source image's alpha matters.
 *
 * Scope boundary: RM-310 only "hosts the span" with the default bundled SVG
 * (theme-map §7.4). The PNG-over-SVG startup override probe from the legacy
 * [`src/ui/shared/icons.ts`](../../ui/shared/icons.ts) is RM-330's deliverable and
 * will replace this component's URL resolution — kept out of here on purpose so
 * the shell task does not claim the icon-override system.
 */
function iconUrl(name: IconName): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith('/') ? base : `${base}/`}icons/${name}.svg`;
}

interface NavIconProps {
  readonly name: IconName;
  /** Square edge length in px (legacy `h-6 w-6` = 24). */
  readonly size?: number;
}

export function NavIcon({ name, size = 24 }: NavIconProps) {
  const mask = `url("${iconUrl(name)}")`;
  return (
    <span
      className="icon-mask"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}
