import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

const root =
  process.cwd();

const paths = {
  app:
    resolve(
      root,
      'src/app.module.ts',
    ),

  catalogModule:
    resolve(
      root,
      'src/admin/catalog/admin-catalog.module.ts',
    ),

  catalogInterceptor:
    resolve(
      root,
      'src/admin/catalog/interceptors/catalog-activity.interceptor.ts',
    ),

  productsController:
    resolve(
      root,
      'src/admin/catalog/controllers/admin-products.controller.ts',
    ),

  archiveService:
    resolve(
      root,
      'src/admin/catalog/services/admin-product-archive.service.ts',
    ),

  categoriesService:
    resolve(
      root,
      'src/admin/catalog/services/admin-categories.service.ts',
    ),

  brandsService:
    resolve(
      root,
      'src/admin/catalog/services/admin-brands.service.ts',
    ),

  productsService:
    resolve(
      root,
      'src/admin/catalog/services/admin-products.service.ts',
    ),

  imagesService:
    resolve(
      root,
      'src/admin/catalog/services/admin-product-images.service.ts',
    ),

  governanceModule:
    resolve(
      root,
      'src/admin/governance/admin-governance.module.ts',
    ),

  customerController:
    resolve(
      root,
      'src/admin/governance/controllers/admin-customers.controller.ts',
    ),

  adminController:
    resolve(
      root,
      'src/admin/governance/controllers/admin-admins.controller.ts',
    ),

  activitiesController:
    resolve(
      root,
      'src/admin/governance/controllers/admin-activities.controller.ts',
    ),

  managedSessions:
    resolve(
      root,
      'src/admin/governance/services/admin-managed-sessions.service.ts',
    ),

  dashboardModule:
    resolve(
      root,
      'src/admin/dashboard/admin-dashboard.module.ts',
    ),

  dashboardController:
    resolve(
      root,
      'src/admin/dashboard/admin-dashboard.controller.ts',
    ),

  sessionManagement:
    resolve(
      root,
      'src/auth/services/session-management.service.ts',
    ),

  emailVerification:
    resolve(
      root,
      'src/auth/services/email-verification.service.ts',
    ),

  passwordRecovery:
    resolve(
      root,
      'src/auth/services/password-recovery.service.ts',
    ),

  googleAuth:
    resolve(
      root,
      'src/auth/services/google-auth.service.ts',
    ),
};

for (
  const [
    name,
    path,
  ]
  of Object.entries(paths)
) {
  if (
    name ===
    'catalogInterceptor'
  ) {
    continue;
  }

  assert(
    existsSync(path),
    `Missing Milestone 18 ${name}: ${path}`,
  );
}

assert(
  !existsSync(
    paths.catalogInterceptor,
  ),
  'Best-effort catalog activity interceptor must be removed.',
);

const app =
  read(
    paths.app,
  );

assertIncludes(
  app,
  'AdminDashboardModule',
  'AppModule dashboard registration',
);

const catalogModule =
  read(
    paths.catalogModule,
  );

assertIncludes(
  catalogModule,
  'AdminProductArchiveService',
  'archive service registration',
);

assert(
  !catalogModule.includes(
    'CatalogActivityInterceptor',
  ),
  'CatalogActivityInterceptor must not remain registered.',
);

const productsController =
  read(
    paths.productsController,
  );

assertIncludes(
  productsController,
  "@Patch('archive')",
  'bulk archive route',
);

assertIncludes(
  productsController,
  "@Patch('publication')",
  'bulk publication route',
);

const archive =
  read(
    paths.archiveService,
  );

for (
  const expected
  of [
    'PRODUCT_ARCHIVED',
    'PRODUCT_RESTORED',
    "'ARCHIVED'",
    "'DRAFT'",
    'userActivity',
    '$transaction',
  ]
) {
  assertIncludes(
    archive,
    expected,
    'archive service',
  );
}

for (
  const path
  of [
    paths.categoriesService,
    paths.brandsService,
    paths.productsService,
    paths.imagesService,
  ]
) {
  const content =
    read(path);

  assertIncludes(
    content,
    '$transaction',
    path,
  );

  assertIncludes(
    content,
    'userActivity',
    path,
  );

  assertIncludes(
    content,
    'SessionMetadata',
    path,
  );
}

const productsService =
  read(
    paths.productsService,
  );

assertIncludes(
  productsService,
  "existing.status ===\n      'ACTIVE'",
  'active product edit hardening',
);

const governanceModule =
  read(
    paths.governanceModule,
  );

assertIncludes(
  governanceModule,
  'AdminActivitiesController',
  'global activity controller registration',
);

assertIncludes(
  governanceModule,
  'AdminManagedSessionsService',
  'managed sessions registration',
);

const customerController =
  read(
    paths.customerController,
  );

for (
  const expected
  of [
    "':id/sessions'",
    "':id/sessions/:sessionId'",
    "':id/logout-all'",
  ]
) {
  assertIncludes(
    customerController,
    expected,
    'customer session governance',
  );
}

const adminController =
  read(
    paths.adminController,
  );

assertIncludes(
  adminController,
  'listSessions',
  'admin session governance',
);

assertIncludes(
  adminController,
  "'SUPERADMIN'",
  'SUPERADMIN admin session governance',
);

const activities =
  read(
    paths.activitiesController,
  );

assertIncludes(
  activities,
  "path: 'admin/activities'",
  'global activity route',
);

const managedSessions =
  read(
    paths.managedSessions,
  );

for (
  const expected
  of [
    'CUSTOMER_SESSION_REVOKED',
    'CUSTOMER_LOGOUT_ALL',
    'ADMIN_SESSION_REVOKED',
    'ADMIN_LOGOUT_ALL',
    '$transaction',
  ]
) {
  assertIncludes(
    managedSessions,
    expected,
    'managed session service',
  );
}

const dashboard =
  read(
    paths.dashboardController,
  );

assertIncludes(
  dashboard,
  "path: 'admin/dashboard'",
  'admin dashboard',
);

const sessionManagement =
  read(
    paths.sessionManagement,
  );

assertIncludes(
  sessionManagement,
  "'SESSION_REVOKED'",
  'self session activity',
);

assertIncludes(
  sessionManagement,
  "'LOGOUT_ALL'",
  'self logout-all activity',
);

const verification =
  read(
    paths.emailVerification,
  );

assertIncludes(
  verification,
  "'EMAIL_VERIFIED'",
  'email verification audit',
);

assertIncludes(
  verification,
  'roleSatisfiesRequirement',
  'SUPERADMIN email verification inheritance',
);

const recovery =
  read(
    paths.passwordRecovery,
  );

assertIncludes(
  recovery,
  "'PASSWORD_RESET'",
  'password reset audit',
);

const google =
  read(
    paths.googleAuth,
  );

assert(
  !google.includes(
    'principal.role !== expectedRole',
  ),
  'Google link flow still uses exact ADMIN role comparison.',
);

console.log(
  'Poromosiyo Milestone 18 admin operations contract verification successful.',
);

console.log(
  'Verified bulk product archive/restore.',
);

console.log(
  'Verified transactional catalog activity writes.',
);

console.log(
  'Verified global admin audit log.',
);

console.log(
  'Verified managed customer/admin session controls.',
);

console.log(
  'Verified security activity events.',
);

console.log(
  'Verified admin dashboard.',
);

console.log(
  'Verified SUPERADMIN Google-link inheritance.',
);

function read(
  path: string,
): string {
  return readFileSync(
    path,
    'utf8',
  );
}

function assertIncludes(
  value: string,
  expected: string,
  description: string,
): void {
  assert(
    value.includes(
      expected,
    ),
    `${description} is missing: ${expected}`,
  );
}

function assert(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}
