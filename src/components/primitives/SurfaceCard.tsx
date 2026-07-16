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
import { mergeSx } from './mergeSx';

export interface SurfaceCardProps {
  children: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  /** Optional media rendered edge-to-edge above the card content. */
  media?: ReactNode;
  /** Makes the whole card a hash/native link for list-card navigation. */
  href?: string;
  /** Optional explicit accessible name for a clickable card. */
  linkLabel?: string;
  headingComponent?: 'h2' | 'h3';
  sx?: SxProps<Theme>;
}

/** Shared titled/untitled surface, including the clickable member-list variant. */
export function SurfaceCard({
  children,
  title,
  actions,
  media,
  href,
  linkLabel,
  headingComponent = 'h2',
  sx,
}: SurfaceCardProps) {
  const generatedId = useId();
  const titleId = title ? `surface-card-${generatedId.replace(/:/g, '')}` : undefined;
  const content = (
    <>
      {media}
      <CardContent sx={{ p: 4, '&:last-child': { pb: 4 } }}>
        <Stack spacing={3}>
          {title ? (
            <Typography id={titleId} component={headingComponent} variant="h3">
              {title}
            </Typography>
          ) : null}
          {children}
          {actions ? (
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {actions}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </>
  );

  return (
    <Card
      component="section"
      aria-labelledby={titleId}
      sx={mergeSx({ overflow: 'hidden' }, sx)}
    >
      {href ? (
        <CardActionArea href={href} aria-label={linkLabel}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}

export type NestedSurfaceProps = Omit<PaperProps, 'variant'>;

/** Lower-elevation bordered section used inside dashboard cards. */
export function NestedSurface({ children, sx, ...props }: NestedSurfaceProps) {
  return (
    <Paper
      {...props}
      component={props.component ?? 'section'}
      variant="outlined"
      sx={mergeSx({ p: 3, borderRadius: 3 }, sx)}
    >
      {children}
    </Paper>
  );
}
