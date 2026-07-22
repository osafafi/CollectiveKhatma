import { Stack } from '@mui/material';
import { selectKhatmas, useAppSelector } from '@/app/store';
import { CreateKhatmaForm } from '@/app/admin/khatmas/CreateKhatmaForm';
import { KhatmasList } from '@/app/admin/khatmas/KhatmasList';

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
      <KhatmasList khatmas={khatmas} />
      <CreateKhatmaForm khatmas={khatmas} />
    </Stack>
  );
}
