import '@/theme/theme.css';
import { strings } from '@/content/strings.ar';
import { initReadingScale } from '@/theme/reading';
import { resolveIconOverrides } from '@/ui/shared/icons';
import { renderAdmin } from '@/ui/admin/render';

document.title = strings.admin.title;
initReadingScale();
resolveIconOverrides();

const root = document.getElementById('app');
if (root) renderAdmin(root);
