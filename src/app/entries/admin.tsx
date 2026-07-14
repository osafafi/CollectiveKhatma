import { resolveIconOverrides } from '@/components/icons';
import { AdminApp } from '@/app/admin/AdminApp';
import { mountReactApp } from '@/app/bootstrap';

resolveIconOverrides();
mountReactApp(<AdminApp />);
