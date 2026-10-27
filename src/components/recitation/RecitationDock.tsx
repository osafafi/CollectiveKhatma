import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { recitationDockLayout } from '@/components/navigation/layoutContracts';
import { strings } from '@/content/strings.ar';

export type RecitationDockStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export interface RecitationDockProps {
  status: RecitationDockStatus;
  /** The full bar (a session is open) rather than the round play button. */
  expanded: boolean;
  verseLabel?: string;
  qariName: string;
  /** The page is not ready to start from yet. */
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

const gradientButtonSx = (theme: Theme) => ({
  background: theme.custom.primaryBtnGradient,
  color: theme.custom.onEmerald,
  boxShadow: theme.custom.btnShadow,
  '&:hover': { background: theme.custom.primaryBtnGradient },
  '&.Mui-disabled': { opacity: 0.5, color: theme.custom.onEmerald },
});

/**
 * The reader's floating recitation control. Collapsed, it is one round play
 * button above the tab bar; once a session is open it becomes a bar with the
 * playing verse, the voice, and the transport. Verse buttons follow the page
 * nav's book order: previous on the right, next on the left, arrows mirrored to
 * point the way they move.
 */
export function RecitationDock({
  status,
  expanded,
  verseLabel,
  qariName,
  disabled = false,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onClose,
}: RecitationDockProps) {
  const playing = status === 'playing';
  const loading = status === 'loading';
  const toggle = playing || loading ? onPause : onPlay;
  const toggleLabel =
    playing || loading ? strings.recitation.pause : strings.recitation.play;

  return (
    <>
      <Box
        aria-hidden="true"
        sx={{ height: recitationDockLayout.clearance, flex: 'none' }}
      />
      <Box
        component="section"
        aria-label={strings.recitation.playerLabel}
        sx={(theme) => ({
          position: 'fixed',
          zIndex: 'appBar',
          pointerEvents: 'none',
          insetInline: {
            xs: recitationDockLayout.mobile.insetInline,
            lg: 'auto',
          },
          insetInlineStart: { lg: recitationDockLayout.desktop.insetInlineStart },
          insetInlineEnd: { lg: recitationDockLayout.desktop.insetInlineEnd },
          top: recitationDockLayout.mobile.top,
          bottom: 'auto',
          transform: {
            xs: recitationDockLayout.mobile.transform,
            lg: recitationDockLayout.desktop.transform,
          },
          transition: `transform ${theme.custom.motion.fast} ${theme.custom.motion.easing}`,
        })}
      >
        <Box
          sx={{
            maxWidth: recitationDockLayout.maxWidth,
            mx: 'auto',
            px: 4,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          {expanded ? (
            <Box
              sx={(theme) => ({
                pointerEvents: 'auto',
                width: '100%',
                minHeight: 64,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                bgcolor: 'background.paper',
                backgroundImage: theme.custom.cardBg.startsWith('linear-gradient')
                  ? theme.custom.cardBg
                  : 'none',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: `${theme.custom.radii.card}px`,
                boxShadow: theme.custom.cardShadow,
                animation: `fadeUp ${theme.custom.motion.fast} ${theme.custom.motion.easing}`,
              })}
            >
              <IconButton aria-label={strings.recitation.previous} onClick={onPrevious}>
                <SkipPreviousRoundedIcon sx={{ transform: 'scaleX(-1)' }} />
              </IconButton>
              <IconButton
                aria-label={toggleLabel}
                onClick={toggle}
                sx={(theme) => ({ width: 48, height: 48, ...gradientButtonSx(theme) })}
              >
                {loading ? (
                  <CircularProgress size={22} color="inherit" aria-hidden="true" />
                ) : playing ? (
                  <PauseRoundedIcon />
                ) : (
                  <PlayArrowRoundedIcon />
                )}
              </IconButton>
              <IconButton aria-label={strings.recitation.next} onClick={onNext}>
                <SkipNextRoundedIcon sx={{ transform: 'scaleX(-1)' }} />
              </IconButton>
              <Box sx={{ flex: 1, minWidth: 0, px: 1 }}>
                <Typography
                  role="status"
                  noWrap
                  sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.4 }}
                >
                  {verseLabel ?? strings.recitation.loading}
                </Typography>
                <Typography
                  noWrap
                  color="text.secondary"
                  sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}
                >
                  {qariName}
                </Typography>
              </Box>
              <IconButton aria-label={strings.recitation.close} onClick={onClose}>
                <CloseRoundedIcon />
              </IconButton>
            </Box>
          ) : (
            <IconButton
              aria-label={strings.recitation.play}
              onClick={onPlay}
              disabled={disabled}
              sx={(theme) => ({
                pointerEvents: 'auto',
                width: 56,
                height: 56,
                ...gradientButtonSx(theme),
              })}
            >
              <PlayArrowRoundedIcon fontSize="large" />
            </IconButton>
          )}
        </Box>
      </Box>
    </>
  );
}
