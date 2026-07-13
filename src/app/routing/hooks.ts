import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';
import {
  adminRoutePath,
  memberRoutePath,
  parseAdminRoute,
  parseMemberRoute,
  type AdminRoute,
  type MemberRoute,
} from '@/app/routing/routes';

/** Read the current member route as a discriminated union. */
export function useMemberRoute(): MemberRoute {
  const { pathname } = useLocation();
  return useMemo(() => parseMemberRoute(pathname), [pathname]);
}

/** Read the current admin route as a discriminated union. */
export function useAdminRoute(): AdminRoute {
  const { pathname } = useLocation();
  return useMemo(() => parseAdminRoute(pathname), [pathname]);
}

/** Navigate without allowing feature code to assemble route strings. */
export function useMemberNavigate(): (
  route: MemberRoute,
  options?: NavigateOptions,
) => void {
  const navigate = useNavigate();
  return useCallback(
    (route, options) => navigate(memberRoutePath(route), options),
    [navigate],
  );
}

export function useAdminNavigate(): (
  route: AdminRoute,
  options?: NavigateOptions,
) => void {
  const navigate = useNavigate();
  return useCallback(
    (route, options) => navigate(adminRoutePath(route), options),
    [navigate],
  );
}
