# Environment Rules

> Status: Mandatory
> Project: Poromosiyo API

## Runtime Baseline

Poromosiyo uses:

```text
Node.js 24.19.0
npm     11.17.0
```

`.nvmrc` must contain:

```text
24.19.0
```

`package.json` must continue enforcing the approved runtime through
`engines`, `devEngines`, and `packageManager`.


## Local Port

The reserved local development port is:

```text
3000
```

Do not change this port without coordinating the other Poromosiyo projects.


## Environment Files

Local secrets belong in ignored environment files.

Safe documentation belongs in:

```text
.env.example
```

Never commit real secrets.

Every environment variable introduced by application code must also be
documented in `.env.example` before the feature is considered complete.

## Environment Boundaries

Development, test, staging, and production credentials must remain separate.

Never use production credentials for local development.

Never expose server-only credentials through browser-visible variables.

Variables prefixed with `NEXT_PUBLIC_` must be treated as public information.
