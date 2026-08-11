# Admin Acceptance & Hardening — Milestone 17

## Purpose

Milestone 17 is the final acceptance gate for the current Poromosiyo admin
backend before public/customer catalog endpoints are introduced.

## Role Matrix

```text
CUSTOMER
  - no /api/v1/admin/* access

ADMIN
  - catalog CRUD
  - product publication
  - customer governance
  - view administrators
  - view customer/admin activity
  - cannot create ADMIN
  - cannot block ADMIN

SUPERADMIN
  - inherits all ADMIN permissions
  - can create ADMIN
  - can block/unblock ADMIN
```
