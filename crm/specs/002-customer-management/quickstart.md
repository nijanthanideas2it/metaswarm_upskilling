# Quickstart Validation Guide: Customer Management

**Feature**: 002-customer-management
**Date**: 2026-06-16
**Depends on**: `001-user-auth` running and seeded

This guide documents how to validate the Customer Management module end-to-end
in a local environment. See contracts and data model for full field references.

---

## Prerequisites

- Auth module (`001-user-auth`) deployed and seeded with an Admin user
- PostgreSQL migrations for this feature applied: `npx prisma migrate dev`
- `pg_trgm` extension enabled (applied by migration)
- Server running: `npm run dev` from `backend/`
- Admin access token obtained via login (see auth quickstart)

```bash
# Obtain an admin access token
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Admin123!"}')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.data.accessToken')
```

---

## Scenario 1 — Create an Organisation

```bash
ORG=$(curl -s -X POST http://localhost:3000/api/v1/organizations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","emailDomain":"acme.com","industry":"Manufacturing"}')

echo $ORG | jq .
ORG_ID=$(echo $ORG | jq -r '.data.id')
```

**Expected**: HTTP 201; `data.name = "Acme Corp"`; `data.memberCount = 0`.

---

## Scenario 2 — Create a Customer (linked to org)

```bash
CUSTOMER=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Jane Smith\",\"email\":\"jane@acme.com\",\"jobTitle\":\"Lead\",\"organizationId\":\"$ORG_ID\"}")

echo $CUSTOMER | jq .
CUSTOMER_ID=$(echo $CUSTOMER | jq -r '.data.id')
```

**Expected**: HTTP 201; `data.organizationName = "Acme Corp"`.
Check Mailtrap/Ethereal for the invitation email to `jane@acme.com`.

---

## Scenario 3 — Duplicate Email Rejected

```bash
curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Duplicate","email":"jane@acme.com"}' | jq .error.code
```

**Expected**: `"EMAIL_ALREADY_EXISTS"` (HTTP 409).

---

## Scenario 4 — Search Customers

```bash
curl -s "http://localhost:3000/api/v1/customers/search?q=jane" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected**: HTTP 200; `data` array contains Jane Smith; `meta.total >= 1`.

```bash
# Short query rejected
curl -s "http://localhost:3000/api/v1/customers/search?q=j" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .error.code
```

**Expected**: `"VALIDATION_ERROR"` (HTTP 422).

---

## Scenario 5 — View Customer Profile

```bash
curl -s "http://localhost:3000/api/v1/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected**: HTTP 200; `data.ticketSummary.totalTickets = 0` (stub in v1);
`data.organizationName = "Acme Corp"`.

---

## Scenario 6 — Agent Cannot Create a Customer

```bash
# Login as agent (seeded test user)
AGENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@company.com","password":"Agent123!"}' \
  | jq -r '.data.accessToken')

curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Bad Actor","email":"bad@example.com"}' | jq .error.code
```

**Expected**: `"FORBIDDEN"` (HTTP 403).

---

## Scenario 7 — Update Customer Profile (as Manager)

```bash
MANAGER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@company.com","password":"Manager123!"}' \
  | jq -r '.data.accessToken')

curl -s -X PATCH "http://localhost:3000/api/v1/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobTitle":"Senior Lead"}' | jq .data.jobTitle
```

**Expected**: `"Senior Lead"`.

```bash
# Manager cannot change email
curl -s -X PATCH "http://localhost:3000/api/v1/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"newemail@acme.com"}' | jq .error.code
```

**Expected**: `"FORBIDDEN"` (HTTP 403).

---

## Scenario 8 — Customer Updates Own Profile

```bash
# Customer sets their password via invite link first (auth module), then logs in
CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"CustomerSet1!"}' \
  | jq -r '.data.accessToken')

# Update own profile
curl -s -X PATCH "http://localhost:3000/api/v1/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1 555 000 1111"}' | jq .data.phone
```

**Expected**: `"+1 555 000 1111"`.

```bash
# Customer cannot view another customer's profile
curl -s "http://localhost:3000/api/v1/customers/some-other-customer-id" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq .error.code
```

**Expected**: `"FORBIDDEN"` (HTTP 403).

---

## Scenario 9 — Deactivate and Reactivate a Customer

```bash
# Deactivate
curl -s -X POST "http://localhost:3000/api/v1/customers/$CUSTOMER_ID/deactivate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data.status
```

**Expected**: `"DEACTIVATED"`.

```bash
# Attempt login as deactivated customer
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"CustomerSet1!"}' | jq .error.code
```

**Expected**: `"ACCOUNT_DEACTIVATED"` (HTTP 403) — within 5 seconds of deactivation.

```bash
# Reactivate
curl -s -X POST "http://localhost:3000/api/v1/customers/$CUSTOMER_ID/reactivate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data.status
```

**Expected**: `"ACTIVE"`.

---

## Scenario 10 — Organisation Deletion Blocked by Members

```bash
curl -s -X DELETE "http://localhost:3000/api/v1/organizations/$ORG_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .error.code
```

**Expected**: `"ORGANISATION_HAS_MEMBERS"` (HTTP 409).

```bash
# Remove member first, then delete
curl -s -X DELETE \
  "http://localhost:3000/api/v1/organizations/$ORG_ID/members/$CUSTOMER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o /dev/null -w "%{http_code}"
# Expected: 204

curl -s -X DELETE "http://localhost:3000/api/v1/organizations/$ORG_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o /dev/null -w "%{http_code}"
# Expected: 204
```

---

## Scenario 11 — Audit Trail

```bash
curl -s "http://localhost:3000/api/v1/customers/$CUSTOMER_ID/audit" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected**: HTTP 200; entries for `jobTitle` change (Scenario 7) and `phone`
change (Scenario 8) present with `fieldName`, `previousValue`, `newValue`,
`changedBy`, and `changedAt`.

---

## Running the Test Suite

```bash
cd backend

# Unit tests (use cases — no DB required)
npm run test:unit

# Integration tests (repositories — requires test DB)
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration

# Contract tests (API routes)
npm run test:contract

# Full coverage report
npm run test:coverage
```

**Coverage gate**: ≥ 80% lines and branches. CI blocks merge on failure.

---

## References

- Data model: [data-model.md](data-model.md)
- Customer contracts: [contracts/customers.md](contracts/customers.md)
- Organisation contracts: [contracts/organizations.md](contracts/organizations.md)
- Research decisions: [research.md](research.md)
- Feature spec: [spec.md](spec.md)
- Auth module quickstart: [../001-user-auth/quickstart.md](../001-user-auth/quickstart.md)
