import type { AuthRole } from './types/auth.types';

export function isAuthRole(role: unknown): role is AuthRole {
  return role === 'CUSTOMER' || role === 'ADMIN' || role === 'SUPERADMIN';
}

export function isAdminAuthRole(role: unknown): role is 'ADMIN' | 'SUPERADMIN' {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export function roleSatisfiesRequirement(
  actualRole: unknown,
  requiredRole: AuthRole,
): boolean {
  if (!isAuthRole(actualRole)) {
    return false;
  }

  if (requiredRole === 'ADMIN') {
    return isAdminAuthRole(actualRole);
  }

  return actualRole === requiredRole;
}

export function roleSatisfiesAnyRequirement(
  actualRole: unknown,
  requiredRoles: readonly AuthRole[],
): boolean {
  return requiredRoles.some((requiredRole) =>
    roleSatisfiesRequirement(actualRole, requiredRole),
  );
}
