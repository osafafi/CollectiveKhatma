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
  // A plain <section>, not <main>: the shell's content column now owns the sole
  // `main` landmark, so this placeholder must not introduce a second one.
  return (
    <section data-react-surface={surface} data-route={routeName}>
      <header>
        <p>{strings.preview.migrationLabel}</p>
        <h1>{heading}</h1>
      </header>
      <p>{description}</p>
      <p role="status">{strings.preview.notProduction}</p>
    </section>
  );
}
