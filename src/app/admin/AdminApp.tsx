import { strings } from '@/content/strings.ar';
import { PreviewShell } from '@/app/PreviewShell';

export function AdminApp() {
  return (
    <PreviewShell
      surface="admin"
      heading={strings.preview.adminHeading}
      description={strings.admin.heading}
    />
  );
}
