# Store Catalog — Milestone 19

Every Poromosiyo product belongs to exactly one Store.

## Store model

A Store contains:

- name;
- slug;
- optional description;
- optional logo;
- optional website;
- active state.

## Admin routes

```text
GET    /api/v1/admin/stores
GET    /api/v1/admin/stores/:id
POST   /api/v1/admin/stores
PATCH  /api/v1/admin/stores/:id
DELETE /api/v1/admin/stores/:id
```
