import { Link, type LinkProps } from 'react-router-dom';
import {
  adminRoutePath,
  memberRoutePath,
  type AdminRoute,
  type MemberRoute,
} from '@/app/routing/routes';

export type MemberRouteLinkProps = Omit<LinkProps, 'to'> & { to: MemberRoute };
export type AdminRouteLinkProps = Omit<LinkProps, 'to'> & { to: AdminRoute };

/** Typed links for member and admin navigation inside the shared hash router. */
export function MemberRouteLink({ to, ...props }: MemberRouteLinkProps) {
  return <Link {...props} to={memberRoutePath(to)} />;
}

export function AdminRouteLink({ to, ...props }: AdminRouteLinkProps) {
  return <Link {...props} to={adminRoutePath(to)} />;
}
