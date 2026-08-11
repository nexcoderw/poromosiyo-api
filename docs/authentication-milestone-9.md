# Authentication Milestone 9

## Scope

Milestone 9 implements:

- email verification;
- resend verification;
- forgot password;
- password reset;
- authenticated password change;
- SMTP-ready authentication email delivery;
- password-change notifications;
- session invalidation after password reset/change.

## Customer Routes

```text
POST /api/v1/auth/email-verification/resend
POST /api/v1/auth/email-verification/confirm
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/change-password
```
