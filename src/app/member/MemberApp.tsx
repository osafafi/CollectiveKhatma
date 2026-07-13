import { strings } from '@/content/strings.ar';
import { PreviewShell } from '@/app/PreviewShell';

export function MemberApp() {
  return (
    <PreviewShell
      surface="member"
      heading={strings.preview.memberHeading}
      description={strings.member.tagline}
    />
  );
}
