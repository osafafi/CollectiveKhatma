import { strings } from '@/content/strings.ar';

interface PreviewShellProps {
  surface: 'member' | 'admin';
  heading: string;
  description: string;
}

export function PreviewShell({ surface, heading, description }: PreviewShellProps) {
  return (
    <main data-react-surface={surface}>
      <header>
        <p>{strings.preview.migrationLabel}</p>
        <h1>{heading}</h1>
      </header>
      <p>{description}</p>
      <p role="status">{strings.preview.notProduction}</p>
    </main>
  );
}
