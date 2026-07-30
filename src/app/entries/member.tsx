import { resolveIconOverrides } from '@/components/icons';
import { strings } from '@/content/strings.ar';
import { MemberApp } from '@/app/member/MemberApp';
import { initializeMemberInstall } from '@/app/member/install/memberInstall';
import { mountReactApp } from '@/app/bootstrap';

document.title = strings.member.title;
resolveIconOverrides();
initializeMemberInstall();
mountReactApp(<MemberApp />);
