import '@/theme/theme.css';
import { strings } from '@/content/strings.ar';
import { initReadingScale } from '@/theme/reading';
import { resolveIconOverrides } from '@/ui/shared/icons';
import { renderMember } from '@/ui/member/render';

document.title = strings.member.title;
initReadingScale();
resolveIconOverrides();

const root = document.getElementById('app');
if (root) renderMember(root);
