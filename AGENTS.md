# Poromosiyo API Agent Instructions

This file is the mandatory entry point for AI agents working in the
Poromosiyo NestJS API repository.

## Mandatory Reading

Read before every task:

1. `docs/project-overview.md`
2. `docs/git.md`
3. the task-specific documents below

Do not load every document unnecessarily.

## Documentation Router

| Task | Required documents |
| --- | --- |
| Understand the API | `README.md`, `docs/architecture.md` |
| Add or change endpoints | `docs/api-contract.md`, `docs/security.md` |
| Use the database package | `docs/database-integration.md`, `../db/docs/package-consumption.md` |
| Authentication or authorization | `docs/security.md`, `docs/api-contract.md` |
| Environment configuration | `docs/environment.md`, `docs/security.md` |
| Tests or validation | `docs/testing-quality.md` |
| CI | `docs/ci.md`, `docs/testing-quality.md` |

## Non-Negotiable Rules

- This repository owns HTTP behavior and business logic.
- This repository owns request validation and response contracts.
- This repository owns authentication and authorization enforcement.
- `../db` owns the Prisma schema and every structural database migration.
- Do not create a competing `prisma/schema.prisma` in this repository.
- Do not create API-owned migration files.
- Runtime database access must eventually use `@poromosiyo/db`.
- Frontend authorization checks are never a replacement for API security.
- Keep controllers thin.
- Put business workflows in services or appropriate domain providers.
- Never expose secrets through API responses or logs.
- Never revert unrelated changes.

## Foundation State

Business endpoints are intentionally outside the current foundation stage.

Do not invent product, cart, order, payment, or authentication endpoints
unless the requested milestone explicitly introduces them.

## Verification

Run as applicable:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Report commands that could not run.
