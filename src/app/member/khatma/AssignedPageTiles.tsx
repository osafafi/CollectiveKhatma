import { Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memberHash } from '@/app/routing/routes';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';

/**
 * The design's gold page tiles (mock 2a) for one khatma's assigned pages. Each
 * tile links straight to the assigned reader on its page. Plain anchors rather
 * than ButtonBase, which would reset the app's global keyboard focus ring.
 */
export function AssignedPageTiles({
  khatmaId,
  pages,
}: {
  khatmaId: string;
  pages: readonly number[];
}) {
  return (
    <Stack
      component="ul"
      direction="row"
      spacing={2}
      useFlexGap
      aria-label={strings.reader.assignedPages}
      sx={{ flexWrap: 'wrap', listStyle: 'none', m: 0, p: 0 }}
    >
      {pages.map((page) => (
        <li key={page}>
          <Box
            component="a"
            href={memberHash.khatmaRead(khatmaId, page)}
            aria-label={`${strings.reader.readPage} ${toWesternDigits(page)}`}
            sx={(theme) => ({
              display: 'block',
              minWidth: 52,
              px: 1.5,
              py: 2,
              textAlign: 'center',
              textDecoration: 'none',
              fontSize: '1.125rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: theme.custom.goldInk,
              bgcolor: theme.custom.goldSoft,
              border: `1px solid ${alpha(theme.custom.gold, 0.35)}`,
              borderRadius: `${theme.custom.radii.button}px`,
              transition: theme.transitions.create('border-color'),
              '&:hover, &:active': { borderColor: theme.custom.gold },
            })}
          >
            {toWesternDigits(page)}
          </Box>
        </li>
      ))}
    </Stack>
  );
}
