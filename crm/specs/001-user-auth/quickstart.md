# Quickstart Validation Guide: User Authentication

**Feature**: 001-user-auth
**Date**: 2026-06-16

This guide documents how to validate that the authentication module works
end-to-end in a local environment. It is a run/test guide — implementation
details are in `tasks.md` and source code.

---

## Prerequisites

- Node.js 20 LTS installed
- PostgreSQL 16 running locally (or via Docker)
- SMTP server accessible (or use Ethereal/Mailtrap for local testing)
- `.env` file configured (see Environment Variables below)
- Dependencies installed: `npm install` from `backend/`
- Database migrated: `npx prisma migrate dev` from `backend/`
- Seed data applied: `npx prisma db seed` from `backend/`

## Environment Variables (`.env`)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_dev
JWT_SECRET=your-local-dev-secret-min-32-chars
JWT_EXPIRES_IN=900
REFRESH_TOKEN_EXPIRES_DAYS=7
REFRESH_TOKEN_SECRET=another-local-secret-min-32-chars
BCRYPT_COST_FACTOR=12
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your@ethereal.email
SMTP_PASS=yourpassword
PASSWORD_RESET_BASE_URL=http://localhost:3000
INACTIVITY_TIMEOUT_SECONDS=1800
```

## Start the server

```bash
cd backend
npm run dev
# Server starts at http://localhost:3000
```

---

## Validation Scenarios

### Scenario 1 — Successful Login

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}' | jq .
```

**Expected**: HTTP 200; `data.accessToken` and `data.refreshToken` present;
`data.user.role = "ADMIN"`.

---

### Scenario 2 — Invalid Password (non-revealing error)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrongpassword"}' | jq .
```

**Expected**: HTTP 401; `error.code = "INVALID_CREDENTIALS"`;
message does not reveal which field was wrong.

---

### Scenario 3 — Account Lockout after 5 Failures

Run Scenario 2 five times for the same email, then run again.

```bash
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"agent@example.com","password":"wrong"}' | jq .error.code
done
```

**Expected**: First 5 calls return `"INVALID_CREDENTIALS"`.
6th call returns `"ACCOUNT_LOCKED"`.

---

### Scenario 4 — Token Refresh

```bash
# Step 1: Login
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}')

REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.data.refreshToken')

# Step 2: Refresh
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq .
```

**Expected**: HTTP 200; new `data.accessToken` and new `data.refreshToken`
returned. The original `refreshToken` is now invalid.

---

### Scenario 5 — Refresh Token Rotation (replay rejected)

Continue from Scenario 4.

```bash
# Attempt to use the OLD refresh token (already rotated)
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq .
```

**Expected**: HTTP 401; `error.code = "INVALID_REFRESH_TOKEN"`.

---

### Scenario 6 — Logout

```bash
# Login first
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}')

ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.data.refreshToken')

# Logout
curl -s -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" -o /dev/null -w "%{http_code}"
```

**Expected**: HTTP 204.

Then verify the refresh token is revoked:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq .error.code
```

**Expected**: `"INVALID_REFRESH_TOKEN"`.

---

### Scenario 7 — Forgot Password (known email)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@example.com"}' | jq .
```

**Expected**: HTTP 200; `data.message` contains reset confirmation text.
Check Ethereal/Mailtrap inbox — reset email with a link should arrive within
2 minutes.

---

### Scenario 8 — Forgot Password (unknown email — no enumeration)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"notexist@example.com"}' | jq .
```

**Expected**: HTTP 200; identical response to Scenario 7. Response time
should also be comparable (no observable timing difference).

---

### Scenario 9 — Reset Password (valid token)

1. Complete Scenario 7 to get a reset email.
2. Extract the `token` query parameter from the link in the email.
3. Submit:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<token-from-email>","newPassword":"NewPass99!"}' | jq .
```

**Expected**: HTTP 200. Login with new password succeeds.
Login with old password returns 401.

---

### Scenario 10 — Expired Reset Link

Wait 1 hour after generating a reset token (or temporarily set
`PASSWORD_RESET_EXPIRES_HOURS=0.001` for testing), then attempt the reset.

**Expected**: HTTP 400; `error.code = "INVALID_RESET_TOKEN"`.

---

## Running the Test Suite

```bash
cd backend

# Unit tests (use cases — no DB required)
npm run test:unit

# Integration tests (repositories — requires test DB)
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration

# Contract tests (API routes — spins up Express)
npm run test:contract

# All tests with coverage report
npm run test:coverage
```

**Coverage gate**: The CI pipeline enforces ≥ 80% line and branch coverage.
A build that drops below this threshold MUST NOT merge.

---

## References

- Data model: [data-model.md](data-model.md)
- API contracts: [contracts/auth.md](contracts/auth.md)
- Research decisions: [research.md](research.md)
- Feature spec: [spec.md](spec.md)
