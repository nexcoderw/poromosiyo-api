# Git Rules

> Status: Mandatory
> Scope: Poromosiyo API
> Working directory: `api/api`

These rules apply to every developer and AI agent working in this repository.

## Working Directory

Run Git commands from inside this repository.

```bash
cd api/api
```

Use repository-relative paths.

Do not use parent-workspace paths when staging files.

Correct:

```bash
git add docs/security.md
git add README.md
```

Incorrect:

```bash
git add api/api/docs/security.md
git -C api/api add docs/security.md
```

## Before Changing Files

Always inspect the working tree:

```bash
git status --short
```

Never overwrite, discard, revert, or stage unrelated work.

## Commit Scope

Use one file per commit unless the user explicitly requests another strategy.

Each commit message must describe the responsibility or behavior changed by
that file.

Good examples:

```text
Document Poromosiyo API security boundaries
Define customer app endpoint organization
Add database migration governance rules
```

Avoid vague messages such as:

```text
fix
update
changes
work
stuff
```

## Never Commit

Never commit:

- `.env`
- `.env.local`
- `.env.production`
- secrets
- passwords
- access tokens
- private keys
- database URLs containing credentials
- database dumps
- customer exports
- payment information
- `node_modules/`
- `.next/`
- `dist/`
- `coverage/`
- logs
- `*.tsbuildinfo`

`.env.example` is allowed only when it contains safe placeholder values.

## Destructive Git Commands

Do not run destructive Git commands unless explicitly requested.

This includes:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
git push --force
git rebase
```

Never rewrite Git history without explicit approval.

## AI Commit Rule

AI agents must not run:

```text
git add
git commit
git push
```

unless the user explicitly requests that action in the current task.

When asked only for commit messages, provide copyable commands without
claiming that commits were created.

## Verification

Before finishing work:

```bash
git status --short
```

Clearly separate pre-existing changes from changes introduced by the task.
