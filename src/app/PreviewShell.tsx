import { strings } from '@/content/strings.ar';

interface PreviewShellProps {
  surface: 'member' | 'admin';
  routeName: string;
  heading: string;
  description: string;
}

export function PreviewShell({
  surface,
  routeName,
  heading,
  description,
}: PreviewShellProps) {
  return (
    <main data-react-surface={surface} data-route={routeName}>
      <header>
        <p>{strings.preview.migrationLabel}</p>
        <h1>{heading}</h1>
      </header>
      <p>{description}</p>
      <p role="status">{strings.preview.notProduction}</p>
    </main>
  );
}
