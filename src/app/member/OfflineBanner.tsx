import { Box } from '@mui/material';
import { NoticeBanner } from '@/components/primitives';
import { appShellFrameSx } from '@/components/navigation/layoutContracts';
import { strings } from '@/content/strings.ar';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Connection banner for the member shell: tells a member that what they are
 * looking at came off their own device, so a stale roster or an unchanged
 * progress bar reads as "saved earlier" rather than as the app being broken.
 *
 * It sits above the shell frame instead of inside the content column, because
 * routed heroes cancel that column's padding to bleed to the top edge
 * (`heroBleedSx`) and would ride up over anything placed in front of them. The
 * frame padding is mirrored here so the banner clears the desktop rail.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <Box sx={appShellFrameSx}>
      <NoticeBanner
        tone="warning"
        // Standing state, not an interruption: announce it politely rather than
        // cutting into whatever a screen reader is already saying.
        role="status"
        sx={{ borderRadius: 0, py: 2, textAlign: 'center', fontWeight: 600 }}
      >
        {strings.member.offlineNotice}
      </NoticeBanner>
    </Box>
  );
}
