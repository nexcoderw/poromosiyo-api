import {
  isAdminAuthRole,
  isAuthRole,
  roleSatisfiesAnyRequirement,
  roleSatisfiesRequirement,
} from './auth-role.util';

describe('authentication role hierarchy', () => {
  it('recognizes every supported role', () => {
    expect(isAuthRole('CUSTOMER')).toBe(true);

    expect(isAuthRole('ADMIN')).toBe(true);

    expect(isAuthRole('SUPERADMIN')).toBe(true);
  });

  it('recognizes both administrator roles', () => {
    expect(isAdminAuthRole('ADMIN')).toBe(true);

    expect(isAdminAuthRole('SUPERADMIN')).toBe(true);

    expect(isAdminAuthRole('CUSTOMER')).toBe(false);
  });

  it('lets SUPERADMIN satisfy ADMIN requirements', () => {
    expect(roleSatisfiesRequirement('SUPERADMIN', 'ADMIN')).toBe(true);
  });

  it('does not let ADMIN satisfy SUPERADMIN requirements', () => {
    expect(roleSatisfiesRequirement('ADMIN', 'SUPERADMIN')).toBe(false);
  });

  it('does not let CUSTOMER satisfy admin requirements', () => {
    expect(
      roleSatisfiesAnyRequirement('CUSTOMER', ['ADMIN', 'SUPERADMIN']),
    ).toBe(false);
  });
});
