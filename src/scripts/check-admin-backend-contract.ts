import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const files = {
  package: resolve(root, 'package.json'),

  envExample: resolve(root, '.env.example'),

  appModule: resolve(root, 'src/app.module.ts'),

  authTypes: resolve(root, 'src/auth/types/auth.types.ts'),

  roleUtil: resolve(root, 'src/auth/auth-role.util.ts'),

  roleGuard: resolve(root, 'src/auth/guards/auth-role.guard.ts'),

  jwtGuard: resolve(root, 'src/auth/guards/jwt-auth.guard.ts'),

  authService: resolve(root, 'src/auth/auth.service.ts'),

  catalogProducts: resolve(
    root,
    'src/admin/catalog/controllers/admin-products.controller.ts',
  ),

  governanceModule: resolve(
    root,
    'src/admin/governance/admin-governance.module.ts',
  ),

  adminController: resolve(
    root,
    'src/admin/governance/controllers/admin-admins.controller.ts',
  ),

  customerController: resolve(
    root,
    'src/admin/governance/controllers/admin-customers.controller.ts',
  ),

  seed: resolve(root, 'src/scripts/seed-superadmin.ts'),

  dbSchema: resolve(root, '../db/prisma/schema.prisma'),
};

for (const [name, path] of Object.entries(files)) {
  assert(existsSync(path), `Missing required ${name}: ${path}`);
}

const packageJson = JSON.parse(read(files.package)) as {
  scripts?: Record<string, string>;
};

const scripts = packageJson.scripts ?? {};

for (const command of [
  'seed:superadmin',
  'admin:contract-check',
  'admin:acceptance',
  'milestone:17:check',
]) {
  assert(
    typeof scripts[command] === 'string',
    `Missing package script: ${command}`,
  );
}

const db = read(files.dbSchema);

for (const expected of [
  'SUPERADMIN',
  'model UserActivity {',
  'blockedAt',
  'blockedReason',
  'blockedByUserId',
  'model Category {',
  'model Brand {',
  'model Product {',
  'model ProductImage {',
]) {
  assertIncludes(db, expected, 'DB schema');
}

const authTypes = read(files.authTypes);

for (const role of ["'CUSTOMER'", "'ADMIN'", "'SUPERADMIN'"]) {
  assertIncludes(authTypes, role, 'AuthRole');
}

const roleUtil = read(files.roleUtil);

assertIncludes(roleUtil, "requiredRole === 'ADMIN'", 'role hierarchy');

assertIncludes(roleUtil, "role === 'SUPERADMIN'", 'role hierarchy');

const roleGuard = read(files.roleGuard);

assertIncludes(roleGuard, 'roleSatisfiesAnyRequirement', 'AuthRoleGuard');

const jwtGuard = read(files.jwtGuard);

assertIncludes(jwtGuard, 'isAuthRole', 'JwtAuthGuard');

const authService = read(files.authService);

assertIncludes(authService, 'roleSatisfiesRequirement', 'AuthService');

const appModule = read(files.appModule);

for (const moduleName of [
  'AuthModule',
  'AdminCatalogModule',
  'AdminGovernanceModule',
]) {
  assertIncludes(appModule, moduleName, 'AppModule');
}

const catalog = read(files.catalogProducts);

assertIncludes(catalog, "@Patch('publication')", 'product publication route');

const admins = read(files.adminController);

assertIncludes(
  admins,
  "path: 'admin/admins'",
  'administrator governance route',
);

assertIncludes(
  admins,
  "@RequireAuthRoles('SUPERADMIN')",
  'SUPERADMIN route enforcement',
);

const customers = read(files.customerController);

assertIncludes(
  customers,
  "path: 'admin/customers'",
  'customer governance route',
);

const seed = read(files.seed);

for (const expected of [
  'SUPERADMIN_FULL_NAME',
  'SUPERADMIN_EMAIL',
  'SUPERADMIN_PASSWORD',
  'PasswordHasherService',
  "role: 'SUPERADMIN'",
]) {
  assertIncludes(seed, expected, 'SUPERADMIN seed');
}

const envExample = read(files.envExample);

assertPlaceholder(envExample, 'SUPERADMIN_FULL_NAME');

assertPlaceholder(envExample, 'SUPERADMIN_EMAIL');

assertPlaceholder(envExample, 'SUPERADMIN_PASSWORD');

console.log('Poromosiyo admin backend contract verification successful.');

console.log('Verified ADMIN/SUPERADMIN role hierarchy.');

console.log('Verified admin catalog module registration.');

console.log('Verified admin governance module registration.');

console.log('Verified dedicated product publication route.');

console.log('Verified secure SUPERADMIN seed contract.');

console.log('Verified Milestone 14 governance DB dependency.');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function assertIncludes(
  value: string,
  expected: string,
  description: string,
): void {
  assert(value.includes(expected), `${description} is missing: ${expected}`);
}

function assertPlaceholder(content: string, key: string): void {
  const expression = new RegExp(`^${key}=\\s*$`, 'm');

  assert(
    expression.test(content),
    `.env.example must contain an empty ${key}= placeholder.`,
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
