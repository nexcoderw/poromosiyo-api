# Poromosiyo API

NestJS backend and server-side business boundary for Poromosiyo.

Poromosiyo is an ecommerce platform focused exclusively on discounted
products.

## Responsibility

This repository owns:

- HTTP APIs;
- business workflows;
- authentication and authorization;
- request validation;
- response serialization;
- administrative operations;
- customer operations;
- integrations with external services.

It does not own the database schema or migration history.

Database ownership belongs to the sibling project:

```text
../db
```

The API will consume that project through:

```text
@poromosiyo/db
```

## Workspace

```text
poromosiyo/
├── api/
│   ├── api/       # this repository
│   └── db/
└── app/
    ├── app/
    └── admin/
```

## Runtime

```text
Node.js 24.19.0
npm     11.17.0
Port    3000
```

## Development

```bash
npm install
npm run start:dev
```

## Quality

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

## Documentation

Start with:

```text
AGENTS.md
docs/README.md
docs/project-overview.md
docs/architecture.md
```

## Current Foundation Status

The API project is currently being established.

Ecommerce business endpoints are intentionally not part of the initial
foundation milestone.
