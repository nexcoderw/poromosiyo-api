# API Security Rules

> Status: Mandatory

The API is the security authority for Poromosiyo.

## Core Rules

- Never trust authentication or role state received only from the frontend.
- Enforce authentication server-side.
- Enforce role authorization server-side.
- Enforce ownership and resource scope server-side.
- Validate every externally supplied input.
- Never log passwords, tokens, payment credentials, or database credentials.
- Never return internal stack traces to production clients.
- Never hard-code secrets.
- Keep production credentials outside source control.
- Treat file uploads as untrusted input.
- Apply least privilege to future database and service credentials.

## Admin Boundary

Admin endpoints must never rely only on hidden UI controls or frontend route
protection.

## Database Boundary

Structural database changes belong to `../db`.

The API must not bypass migration governance with ad-hoc schema-changing SQL.

## Payments

Future payment integrations must not store sensitive card data unless an
explicitly reviewed payment architecture requires and safely supports it.
Prefer provider-hosted/tokenized payment workflows.
