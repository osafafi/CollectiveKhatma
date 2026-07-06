import '@/theme/theme.css';
import { strings } from '@/content/strings.ar';
import { initReadingScale } from '@/theme/reading';
import { renderAdmin } from '@/ui/admin/render';

document.title = strings.admin.title;
initReadingScale();

const root = document.getElementById('app');
if (root) renderAdmin(root);
