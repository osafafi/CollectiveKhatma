import { resolveIconOverrides } from '@/components/icons';
import { strings } from '@/content/strings.ar';
import { MemberApp } from '@/app/member/MemberApp';
import { mountReactApp } from '@/app/bootstrap';

document.title = strings.member.title;
resolveIconOverrides();
mountReactApp(<MemberApp />);
