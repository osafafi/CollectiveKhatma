import { Stack, Typography } from '@mui/material';
import { selectKhatmas, useAppSelector } from '@/app/store';
import { CreateKhatmaForm } from '@/app/admin/khatmas/CreateKhatmaForm';
import { KhatmasList } from '@/app/admin/khatmas/KhatmasList';
import { strings } from '@/content/strings.ar';

/** Route container for the khatma list and route-scoped create workflow. */
export function AdminKhatmasPage() {
  const khatmas = useAppSelector(selectKhatmas);

  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="admin"
      data-route="khatmas"
    >
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.admin.navKhatmas}
      </Typography>
      <KhatmasList khatmas={khatmas} />
      <CreateKhatmaForm khatmas={khatmas} />
    </Stack>
  );
}
