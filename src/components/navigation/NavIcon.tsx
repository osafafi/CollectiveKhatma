import { useIconUrl, type IconName } from '@/components/icons';

/**
 * Navigation icon: a `.icon-mask` span (retained global style, RM-210 §8)
 * painted with `currentColor`, so it inherits the active/inactive tab color set
 * by {@link AppNav}. Only the source image's alpha matters.
 *
 * The mask URL comes from the override-aware icon source (RM-330): the bundled
 * `icons/<name>.svg` by default, upgraded live to a dropped-in `icons/<name>.png`
 * when the startup probe finds one.
 */
interface NavIconProps {
  readonly name: IconName;
  /** Square edge length in px (legacy `h-6 w-6` = 24). */
  readonly size?: number;
}

export function NavIcon({ name, size = 24 }: NavIconProps) {
  const url = useIconUrl(name);
  const mask = `url("${url}")`;
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
