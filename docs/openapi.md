# OpenAPI Documentation

Poromosiyo exposes interactive Swagger UI documentation for every registered
controller endpoint at:

```text
http://localhost:3000/api/v1/docs
```

The machine-readable OpenAPI document is available at:

```text
http://localhost:3000/api/v1/docs-json
```

Start the local API with `npm run start:dev`, open the Swagger UI, and use the
Authorize button to provide an access token returned by the customer or admin
login endpoint. Enter only the token; the interface adds the `Bearer` prefix.

The documentation is generated from the actual NestJS controllers, route
versions, DTO types, and validation decorators. Keep those annotations aligned
with runtime behavior whenever an endpoint or request contract changes.
