# API Architecture

## Boundary

```text
Customer App ──┐
               ├──> NestJS API ──> @poromosiyo/db ──> MySQL
Admin App ─────┘
```

Frontends communicate with this API.

They must not connect directly to the database.

## NestJS Organization

Business domains should be implemented as NestJS modules.

Target direction:

```text
src/
├── common/
├── config/
├── auth/
├── customers/
├── admin/
├── catalog/
├── cart/
├── checkout/
├── orders/
├── payments/
└── app.module.ts
```

This is a target structure, not permission to implement these domains during
the foundation stage.

## Layer Responsibilities

Controllers:

- receive HTTP requests;
- invoke validation;
- call services;
- return serialized results.

Services:

- implement workflows;
- enforce domain rules;
- coordinate repositories and integrations.

Database package:

- provides approved database access;
- owns Prisma client infrastructure;
- owns schema/migrations.

## Common Code

`common/` is only for genuinely cross-domain infrastructure.

Do not move domain logic into `common/` simply because it is reused twice.
