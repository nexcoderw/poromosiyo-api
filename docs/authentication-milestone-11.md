# Authentication Milestone 11

> Status: Authentication backend completion
> Scope: Session/device and authentication-method management

## Customer Routes

```text
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId
POST   /api/v1/auth/logout-all

GET    /api/v1/auth/methods
POST   /api/v1/auth/set-password
POST   /api/v1/auth/google/unlink
```
