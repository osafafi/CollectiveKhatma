import { resolveIconOverrides } from '@/components/icons';
import { MemberApp } from '@/app/member/MemberApp';
import { mountReactApp } from '@/app/bootstrap';

resolveIconOverrides();
mountReactApp(<MemberApp />);
