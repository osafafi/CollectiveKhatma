import { Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memberHash } from '@/app/routing/routes';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';

/**
 * Gold khatma page tiles (mock 2a), or blue tiles for a daily Wird. Each
 * tile links straight to the assigned reader on its page. Plain anchors rather
 * than ButtonBase, which would reset the app's global keyboard focus ring.
 */
export function AssignedPageTiles({
  khatmaId,
  pages,
  tone = 'gold',
}: {
  khatmaId: string;
  pages: readonly number[];
  tone?: 'gold' | 'wird';
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
              color: tone === 'wird' ? theme.custom.wirdInk : theme.custom.goldInk,
              bgcolor: tone === 'wird' ? theme.custom.wirdSoft : theme.custom.goldSoft,
              border: `1px solid ${alpha(tone === 'wird' ? theme.custom.wird : theme.custom.gold, 0.35)}`,
              borderRadius: `${theme.custom.radii.button}px`,
              transition: theme.transitions.create('border-color'),
              '&:hover, &:active': {
                borderColor: tone === 'wird' ? theme.custom.wird : theme.custom.gold,
              },
            })}
          >
            {toWesternDigits(page)}
          </Box>
        </li>
      ))}
    </Stack>
  );
}
