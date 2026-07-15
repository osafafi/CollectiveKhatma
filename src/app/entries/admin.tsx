import { resolveIconOverrides } from '@/components/icons';
import { strings } from '@/content/strings.ar';
import { AdminApp } from '@/app/admin/AdminApp';
import { mountReactApp } from '@/app/bootstrap';

document.title = strings.admin.title;
resolveIconOverrides();
mountReactApp(<AdminApp />);
