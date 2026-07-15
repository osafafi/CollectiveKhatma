import { Button, type ButtonProps } from '@mui/material';
import { mergeSx } from './mergeSx';

export interface AppButtonProps extends ButtonProps {
  /** Full-width, 56px minimum-height action used for senior-facing hero CTAs. */
  hero?: boolean;
  /** Underlined low-emphasis treatment used by legacy link-style actions. */
  quiet?: boolean;
}

/**
 * Shared action primitive covering compact, outlined, quiet, destructive, link,
 * and full-width hero buttons. Standard MUI `variant`/`color` props express the
 * semantic treatment; the app theme supplies parity styling in one place.
 */
export function AppButton({
  hero = false,
  quiet = false,
  variant = 'contained',
  color = 'primary',
  fullWidth,
  size,
  type,
  href,
  sx,
  ...props
}: AppButtonProps) {
  return (
    <Button
      {...props}
      href={href}
      type={type ?? (href ? undefined : 'button')}
      variant={variant}
      color={color}
      fullWidth={hero || fullWidth}
      size={hero ? 'large' : size}
      sx={mergeSx(
        {
          ...(quiet ? { textDecoration: 'underline' } : undefined),
          ...(color === 'inherit' ? { color: 'text.secondary' } : undefined),
        },
        sx,
      )}
    />
  );
}
