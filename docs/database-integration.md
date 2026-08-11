# Database Integration Rules

## Ownership

The database project lives at:

```text
../db
```

and will expose:

```text
@poromosiyo/db
```

## API Rules

The API must not:

- create its own Prisma schema;
- create migration directories;
- run an independent schema-change workflow;
- duplicate the generated Prisma client;
- modify production structure through ad-hoc SQL.

The API may:

- consume approved exports from `@poromosiyo/db`;
- execute runtime reads and writes through that package;
- define business services around database operations.

## Dependency Direction

Correct:

```text
API -> @poromosiyo/db -> Prisma -> MySQL
```

Incorrect:

```text
Frontend -> Prisma
Frontend -> MySQL
API -> API-owned Prisma schema
```

## Current State

The DB package is not connected during Milestone 2.

Package integration will be implemented in the dedicated backend integration
milestone.
