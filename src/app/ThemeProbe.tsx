import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';

/**
 * Temporary RM-210 theme-verification probe (preview-only, not production copy).
 *
 * Renders a slice of the themed surface so the centralized MUI RTL theme can be
 * seen working in the branch preview: palette + radius (Buttons), semantic colors
 * (Chips), a portalled RTL dropdown (Select → Menu portals to `document.body`),
 * and the bundled Quran webfont + reading scale (`.quran-text`). Real primitives
 * arrive in RM-320; this is expected to be replaced then.
 *
 * Kept free of `heading`/`status` roles so it never collides with the preview
 * shell's assertions.
 */
export function ThemeProbe() {
  const [sample, setSample] = useState('1');

  return (
    <Paper variant="outlined" sx={{ p: 4, mt: 4, maxWidth: 520 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        معاينة السمة — RM-210
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Button variant="contained" color="primary">
          زر رئيسي
        </Button>
        <Button variant="outlined" color="primary">
          زر ثانوي
        </Button>
        <Chip color="success" label="مكتمل" />
        <Chip color="warning" label="بانتظار" />
      </Stack>

      <FormControl size="small" sx={{ minWidth: 200, mb: 3 }}>
        <InputLabel id="theme-probe-select-label">قائمة منسدلة</InputLabel>
        <Select
          labelId="theme-probe-select-label"
          label="قائمة منسدلة"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        >
          <MenuItem value="1">الخيار الأول</MenuItem>
          <MenuItem value="2">الخيار الثاني</MenuItem>
          <MenuItem value="3">الخيار الثالث</MenuItem>
        </Select>
      </FormControl>

      <Box className="quran-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Box>
    </Paper>
  );
}
