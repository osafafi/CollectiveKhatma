import { Box, Paper, Stack, Typography } from '@mui/material';
import { DonutChart } from '@/components/charts';
import { SurfaceCard, formatPercent } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import { khatmaShieldProgress, type MemberReadingInsights } from '@/domain/progress';
import { KhatmaCountBadge, KhatmaShieldTrack } from './KhatmaShields';

/**
 * The personal Quran summary card: full-khatma counter, ring toward the next
 * khatma, achievement shields, and the three reading-history tiles.
 */
export function PersonalReadingInsights({
  insights,
}: {
  insights: MemberReadingInsights;
}) {
  const rankText = `${strings.personal.topReadersLead} ${formatPercent(insights.topReaderPercent)} ${strings.personal.topReadersTail}`;
  const shields = khatmaShieldProgress(insights.lifetimePagesRead);

  return (
    <SurfaceCard
      title={strings.personal.quranCompletionHeading}
      titleEnd={<KhatmaCountBadge count={insights.fullKhatmas} tier={shields.current} />}
      appear={0}
    >
      <Stack
        direction="row"
        spacing={{ xs: 2, sm: 4 }}
        sx={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <DonutChart
          percent={insights.nextKhatmaPercent}
          size={132}
          caption={strings.personal.quranDonutCaption.replace(
            '{count}',
            toWesternDigits(insights.fullKhatmas + 1),
          )}
        />
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
            <Typography
              component="span"
              color="text.primary"
              sx={{
                fontSize: { xs: '2rem', sm: '2.75rem' },
                fontWeight: 800,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {toWesternDigits(insights.nextKhatmaPages)}
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              {strings.personal.quranPageTotal}
            </Typography>
          </Stack>
          <Typography component="p" variant="body2" color="text.secondary">
            {strings.personal.lifetimePagesRead.replace(
              '{count}',
              toWesternDigits(insights.lifetimePagesRead),
            )}
          </Typography>
          <Typography component="p" variant="body2" color="text.secondary">
            {rankText}
          </Typography>
        </Stack>
      </Stack>

      <KhatmaShieldTrack progress={shields} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <ReadingStat
          value={insights.completedKhatmas}
          label={strings.personal.completedKhatmas}
        />
        <ReadingStat
          value={insights.pagesReadThisMonth}
          label={strings.personal.pagesThisMonth}
          tone="gold"
        />
        <ReadingStat
          value={insights.longestDailyStreak}
          label={strings.personal.longestDailyStreak}
        />
      </Box>
    </SurfaceCard>
  );
}

function ReadingStat({
  value,
  label,
  tone = 'primary',
}: {
  value: number;
  label: string;
  tone?: 'primary' | 'gold';
}) {
  return (
    <Paper
      component="section"
      aria-label={label}
      elevation={0}
      sx={(theme) => ({
        minHeight: { xs: 132, sm: 148 },
        p: { xs: 2, sm: 3 },
        borderRadius: `${theme.custom.radii.card}px`,
        background: theme.custom.cardBg,
        boxShadow: theme.custom.cardShadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        textAlign: 'center',
      })}
    >
      <Typography
        component="p"
        sx={(theme) => ({
          color: tone === 'gold' ? theme.custom.goldInk : theme.palette.primary.main,
          fontSize: { xs: '1.75rem', sm: '2rem' },
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        {toWesternDigits(value)}
      </Typography>
      <Typography component="p" variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}
