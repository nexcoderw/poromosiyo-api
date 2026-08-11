# Continuous Integration Rules

> Status: Foundation
> Project: Poromosiyo API

CI is not required to be implemented during Milestone 2.

When CI is introduced, it must use the same runtime baseline as local
development:

```text
Node.js 24.19.0
npm     11.17.0
```

## Required Principles

CI must:

- install dependencies from the committed lockfile;
- run linting;
- run type/build validation;
- run applicable automated tests;
- fail when required checks fail;
- never expose secrets in logs;
- use repository/environment secrets rather than committed credentials;
- avoid destructive database commands;
- keep deployment separate from normal pull-request validation.

Deployment workflows will be documented when deployment infrastructure is
introduced.
