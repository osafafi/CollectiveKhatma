import '@/theme/theme.css';
import { strings } from '@/content/strings.ar';
import { initReadingScale } from '@/theme/reading';
import { renderMember } from '@/ui/member/render';

document.title = strings.member.title;
initReadingScale();

const root = document.getElementById('app');
if (root) renderMember(root);
