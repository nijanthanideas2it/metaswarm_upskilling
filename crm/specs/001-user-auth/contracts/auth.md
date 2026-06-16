# API Contracts: Authentication

**Feature**: 001-user-auth
**Date**: 2026-06-16
**Base path**: `/api/v1/auth`
**Response envelope**: `{ "data": <payload | null>, "meta": <object | null>, "error": <object | null> }`

All timestamps: ISO 8601 UTC. All field names: camelCase.
Rate limits apply to all endpoints (see research.md Decision 4).

---

## POST /api/v1/auth/login

Authenticates a user with email and password and returns a token pair.

### Request

```
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "agent@example.com",
  "password": "secret123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `email` | string | Yes | Valid email format, max 254 chars |
| `password` | string | Yes | 8–72 chars |

### Responses

**200 OK** — Credentials valid, account active and unlocked.

```json
{
  "data": {
    "accessToken": "<signed-jwt>",
    "refreshToken": "<opaque-token>",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "agent@example.com",
      "role": "SUPPORT_AGENT"
    }
  },
  "meta": null,
  "error": null
}
```

**401 Unauthorized** — Invalid credentials (email not found OR password wrong — same message for both).

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect.",
    "details": null
  }
}
```

**403 Forbidden** — Account locked (rate threshold exceeded).

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Too many failed login attempts. Account temporarily locked.",
    "details": null
  }
}
```

**403 Forbidden** — Account deactivated.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "ACCOUNT_DEACTIVATED",
    "message": "Account is deactivated. Contact your administrator.",
    "details": null
  }
}
```

**422 Unprocessable Entity** — Validation failure.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "email", "message": "Invalid email address." }
    ]
  }
}
```

**429 Too Many Requests** — IP-level rate limit exceeded.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": null
  }
}
```

---

## POST /api/v1/auth/logout

Invalidates the presented session's refresh token. Requires a valid access token.

### Request

```
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "refreshToken": "<opaque-token>"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `refreshToken` | string | Yes | Non-empty string |

### Responses

**204 No Content** — Session invalidated successfully.

*(empty body)*

**401 Unauthorized** — Access token missing, expired, or invalid.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required.",
    "details": null
  }
}
```

---

## POST /api/v1/auth/refresh

Exchanges a valid refresh token for a new access token and rotated refresh token.
Does NOT require an Authorization header (access token may already be expired).

### Request

```
POST /api/v1/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<opaque-token>"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `refreshToken` | string | Yes | Non-empty string |

### Responses

**200 OK** — New token pair issued; old refresh token revoked.

```json
{
  "data": {
    "accessToken": "<new-signed-jwt>",
    "refreshToken": "<new-opaque-token>",
    "expiresIn": 900
  },
  "meta": null,
  "error": null
}
```

**401 Unauthorized** — Refresh token not found, already revoked, or expired.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token is invalid or has expired.",
    "details": null
  }
}
```

**429 Too Many Requests** — IP-level rate limit exceeded.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": null
  }
}
```

---

## POST /api/v1/auth/forgot-password

Requests a password reset email. Always returns the same response regardless
of whether the email is registered (prevents user enumeration).

### Request

```
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

```json
{
  "email": "agent@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `email` | string | Yes | Valid email format, max 254 chars |

### Responses

**200 OK** — Request acknowledged (identical response whether email exists or not).

```json
{
  "data": {
    "message": "If this email is registered, a reset link has been sent."
  },
  "meta": null,
  "error": null
}
```

**422 Unprocessable Entity** — Validation failure.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "email", "message": "Invalid email address." }
    ]
  }
}
```

**429 Too Many Requests** — IP-level rate limit exceeded.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": null
  }
}
```

---

## POST /api/v1/auth/reset-password

Sets a new password using a valid, single-use reset token from the email link.
Invalidates all active sessions for the user on success.

### Request

```
POST /api/v1/auth/reset-password
Content-Type: application/json
```

```json
{
  "token": "<raw-reset-token-from-email-link>",
  "newPassword": "newSecret99"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `token` | string | Yes | Non-empty string |
| `newPassword` | string | Yes | Min 8 chars; at least 1 letter and 1 number; max 72 chars |

### Responses

**200 OK** — Password changed; all active sessions revoked.

```json
{
  "data": {
    "message": "Password has been reset successfully. Please log in with your new password."
  },
  "meta": null,
  "error": null
}
```

**400 Bad Request** — Token expired or already used.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "INVALID_RESET_TOKEN",
    "message": "This reset link is invalid or has expired. Please request a new one.",
    "details": null
  }
}
```

**422 Unprocessable Entity** — Validation failure (including same-password rejection).

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "newPassword", "message": "New password must be different from your current password." }
    ]
  }
}
```

---

## Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_CREDENTIALS` | 401 | Email/password mismatch (non-revealing) |
| `ACCOUNT_LOCKED` | 403 | Temporary lockout after failed attempts |
| `ACCOUNT_DEACTIVATED` | 403 | Admin has deactivated the account |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token expired, revoked, or not found |
| `INVALID_RESET_TOKEN` | 400 | Reset token expired or already used |
| `VALIDATION_ERROR` | 422 | Request body failed schema validation |
| `RATE_LIMIT_EXCEEDED` | 429 | IP-level rate limit hit |
| `INTERNAL_ERROR` | 500 | Unexpected server fault (generic; no internal detail exposed) |
