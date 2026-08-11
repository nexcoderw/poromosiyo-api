# API Contract Rules

> Status: Foundation

No ecommerce business endpoints are required yet.

These rules apply when endpoints are introduced.

## General Rules

- Use explicit DTOs for request input.
- Validate input server-side.
- Never trust client-provided ownership or role information.
- Return stable JSON response structures.
- Use appropriate HTTP status codes.
- Avoid leaking database implementation details.
- Never return passwords, password hashes, secrets, or private tokens.
- Dates exposed through JSON must use a documented consistent representation.
- Pagination, filtering, sorting, and search rules must be consistent across
  comparable resources.

## Route Ownership

Customer and admin APIs must remain clearly separated where authorization
behavior differs.

Route naming and versioning will be finalized before business endpoints are
introduced.

## Breaking Changes

Do not silently change an established frontend-facing contract.

Coordinate contract changes with:

```text
../../app/app
../../app/admin
```

## Documentation

Once Swagger/OpenAPI is configured, endpoint documentation must remain aligned
with actual validation and response behavior.
