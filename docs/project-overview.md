# Project Overview

## Purpose

Poromosiyo API is the authoritative backend for the customer storefront and
administration portal.

Poromosiyo's product domain is discounted ecommerce.

## Repository Ownership

The API owns:

- HTTP routes;
- DTO validation;
- business rules;
- authentication;
- authorization;
- ownership checks;
- service integrations;
- response contracts;
- server-side auditing.

The API does not own:

- Prisma schema definitions;
- migration history;
- structural database changes;
- frontend rendering;
- frontend styling;
- production secrets.

## Related Projects

```text
../db            database package and schema owner
../../app/app    customer storefront
../../app/admin  administrator portal
```

## Product Principle

Poromosiyo must represent products as discounted offers.

Detailed pricing and discount invariants will be formalized when the ecommerce
database schema and product domain are implemented.
