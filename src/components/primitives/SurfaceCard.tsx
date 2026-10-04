import { useId, type ReactNode } from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  Paper,
  Stack,
  Typography,
  type PaperProps,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { appearSx } from './appearSx';
import { mergeSx } from './mergeSx';

export interface SurfaceCardProps {
  children: ReactNode;
  title?: ReactNode;
  /**
   * Shown at the far end of the title row (the left edge in RTL). Not part of
   * the heading, so the card's accessible name stays the title alone.
   */
  titleEnd?: ReactNode;
  /**
   * Footer row of buttons or links. A link card renders it below its link area
   * rather than inside it, so each action stays its own control.
   */
  actions?: ReactNode;
  /** Optional media rendered edge-to-edge above the card content. */
  media?: ReactNode;
  /** Makes the whole card a hash/native link for list-card navigation. */
  href?: string;
  /** Optional explicit accessible name for a clickable card. */
  linkLabel?: string;
  headingComponent?: 'h2' | 'h3';
  /**
   * List position for the fadeUp entry animation; stagger caps at the design's
   * 0.16s so long lists do not crawl. Omit for no entry motion.
   */
  appear?: number;
  sx?: SxProps<Theme>;
}

/** Shared titled/untitled surface, including the clickable member-list variant. */
export function SurfaceCard({
  children,
  title,
  titleEnd,
  actions,
  media,
  href,
  linkLabel,
  headingComponent = 'h2',
  appear,
  sx,
}: SurfaceCardProps) {
  const generatedId = useId();
  const titleId = title ? `surface-card-${generatedId.replace(/:/g, '')}` : undefined;
  const heading = title ? (
    <Typography id={titleId} component={headingComponent} variant="h3">
      {title}
    </Typography>
  ) : null;
  const actionRow = actions ? (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {actions}
    </Stack>
  ) : null;
  const content = (
    <>
      {media}
      <CardContent sx={{ p: 4, '&:last-child': { pb: 4 } }}>
        <Stack spacing={3}>
          {heading && titleEnd ? (
            <Stack
              direction="row"
              sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
            >
              {heading}
              {titleEnd}
            </Stack>
          ) : (
            heading
          )}
          {children}
          {href ? null : actionRow}
        </Stack>
      </CardContent>
    </>
  );

  return (
    <Card
      component="section"
      aria-labelledby={titleId}
      sx={mergeSx(mergeSx({ overflow: 'hidden' }, appearSx(appear)), sx)}
    >
      {href ? (
        <>
          <CardActionArea href={href} aria-label={linkLabel}>
            {content}
          </CardActionArea>
          {actionRow ? (
            <CardContent sx={{ px: 4, pt: 0, '&:last-child': { pb: 4 } }}>
              {actionRow}
            </CardContent>
          ) : null}
        </>
      ) : (
        content
      )}
    </Card>
  );
}

export type NestedSurfaceProps = Omit<PaperProps, 'variant'>;

/**
 * Lower-elevation bordered section used inside dashboard cards. Pinned to the
 * solid app background: the tweakable card gradient must never reach nested
 * surfaces (design §2.4).
 */
export function NestedSurface({ children, sx, ...props }: NestedSurfaceProps) {
  return (
    <Paper
      {...props}
      component={props.component ?? 'section'}
      variant="outlined"
      sx={mergeSx(
        (theme) => ({
          p: 3,
          borderRadius: `${theme.custom.radii.cardSm}px`,
          bgcolor: 'background.default',
        }),
        sx,
      )}
    >
      {children}
    </Paper>
  );
}
