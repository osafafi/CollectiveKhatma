import { Stack } from '@mui/material';
import { DonutChart, SegmentBar } from '@/components/charts';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';

/** Preview-only composition proving the RM-330 charts in both roots. */
export function ChartsPreview() {
  return (
    <SurfaceCard title={strings.preview.chartsHeading} sx={{ mt: 4, maxWidth: 520 }}>
      <Stack
        direction="row"
        spacing={4}
        useFlexGap
        sx={{ flexWrap: 'wrap', alignItems: 'center' }}
      >
        <DonutChart percent={0} size={88} />
        <DonutChart percent={57} size={88} />
        <DonutChart percent={100} size={88} />
      </Stack>
      <SegmentBar
        segments={[
          { value: 342, color: 'primary', label: strings.admin.legendDone },
          { value: 48, color: 'accent', label: strings.admin.legendPending },
          { value: 214, color: 'neutral', label: strings.admin.legendRemaining },
        ]}
      />
    </SurfaceCard>
  );
}
