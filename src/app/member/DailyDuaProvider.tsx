import { useState, type PropsWithChildren } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AppButton } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { DailyDuaContext } from './dailyDuaContext';

/** Above the khatma interrupt: the final reader's daily prayer survives teardown. */
export function DailyDuaProvider({ children }: PropsWithChildren) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const duration = reducedMotion ? 0 : parseFloat(theme.custom.motion.fast) * 1000;

  return (
    <DailyDuaContext.Provider
      value={(next) => {
        setText(next);
        setOpen(true);
      }}
    >
      {children}
      <Dialog
        open={open}
        fullWidth
        maxWidth="sm"
        aria-labelledby="daily-dua-title"
        aria-describedby="daily-dua-text"
        slots={{ transition: Fade }}
        transitionDuration={duration}
        onClose={() => setOpen(false)}
      >
        <DialogTitle
          id="daily-dua-title"
          sx={{
            background: theme.custom.heroGrad,
            color: theme.custom.heroInk,
            textAlign: 'center',
            py: 3,
          }}
        >
          {strings.dailyDua.title}
        </DialogTitle>
        <DialogContent sx={{ '&&': { pt: 3 } }}>
          <Box
            id="daily-dua-text"
            component="p"
            className="quran-text"
            sx={{
              m: 0,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              textAlign: 'center',
            }}
          >
            {text}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <AppButton fullWidth autoFocus onClick={() => setOpen(false)}>
            {strings.common.done}
          </AppButton>
        </DialogActions>
      </Dialog>
    </DailyDuaContext.Provider>
  );
}
