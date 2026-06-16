# Quickstart Validation Guide: Ticket Management

**Feature**: 003-ticket-management
**Date**: 2026-06-16
**Depends on**: `001-user-auth` and `002-customer-management` running and seeded

---

## Prerequisites

- Auth and Customer modules deployed; Prisma migrations for this feature applied
- PostgreSQL sequence `ticket_reference_seq` created (applied by migration)
- S3-compatible bucket configured; `.env` includes `S3_BUCKET`, `AWS_REGION`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Seed data: one Admin, one Manager, one Agent, one Customer account
- Tokens obtained:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@co.com","password":"Admin123!"}' | jq -r '.data.accessToken')

AGENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@co.com","password":"Agent123!"}' | jq -r '.data.accessToken')

CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Customer1!"}' | jq -r '.data.accessToken')

CUSTOMER_ID=$(curl -s "http://localhost:3000/api/v1/customers/me" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq -r '.data.id')
```

---

## Scenario 1 — Customer Creates a Ticket

```bash
TICKET=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Login broken","description":"Getting 401 on every attempt since 9am.","priority":"HIGH"}')

echo $TICKET | jq .
TICKET_ID=$(echo $TICKET | jq -r '.data.id')
REF=$(echo $TICKET | jq -r '.data.referenceNumber')
echo "Created: $REF"
```

**Expected**: HTTP 201; `referenceNumber` matches `TKT-NNNNN` format; `status = "OPEN"`.

---

## Scenario 2 — Agent Self-Assigns the Ticket

```bash
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/self-assign" \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq .data.assignedAgentName
```

**Expected**: Agent's name returned; status still OPEN.

---

## Scenario 3 — Agent Transitions Status to IN_PROGRESS

```bash
curl -s -X PATCH "http://localhost:3000/api/v1/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}' | jq .data.status
```

**Expected**: `"IN_PROGRESS"`.

---

## Scenario 4 — Agent Adds a Customer-Visible Comment

```bash
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Reproduced the issue. Working on a fix now.","isInternalNote":false}' | jq .data.id
```

**Expected**: HTTP 201; comment created.

---

## Scenario 5 — Agent Adds an Internal Note (invisible to Customer)

```bash
INTERNAL_NOTE_ID=$(curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Root cause: auth service cert expired. Escalating to infra team.","isInternalNote":true}' \
  | jq -r '.data.id')

# Customer should NOT see the internal note
curl -s "http://localhost:3000/api/v1/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq '[.data[].isInternalNote]'
```

**Expected**: The `isInternalNote` field is absent from the customer's response;
the internal note comment ID does not appear in the customer's comment list.

---

## Scenario 6 — Concurrent Self-Assign Race Condition

```bash
# Start two simultaneous self-assign requests
AGENT2_TOKEN=<second-agent-token>
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/self-assign" \
  -H "Authorization: Bearer $AGENT_TOKEN" &
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/self-assign" \
  -H "Authorization: Bearer $AGENT2_TOKEN" &
wait
```

**Expected**: Exactly one request returns 200; the other returns 409 with
`error.code = "ALREADY_ASSIGNED"`.

---

## Scenario 7 — Resolve and Customer Confirms Close

```bash
# Agent resolves
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/resolve" \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq .data.status
# Expected: "RESOLVED"

# Customer confirms close
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/close" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq .data.status
# Expected: "CLOSED"

# CLOSED ticket rejects further comments
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"One more question."}' | jq .error.code
# Expected: "TICKET_CLOSED"
```

---

## Scenario 8 — Customer Reply on RESOLVED Ticket Reopens It

```bash
# Create and resolve a fresh ticket
T2=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Another issue","description":"Details here."}' | jq -r '.data.id')

curl -s -X POST "http://localhost:3000/api/v1/tickets/$T2/self-assign" \
  -H "Authorization: Bearer $AGENT_TOKEN" > /dev/null
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T2/resolve" \
  -H "Authorization: Bearer $AGENT_TOKEN" > /dev/null

# Customer replies — should revert to IN_PROGRESS
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T2/comments" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Still broken after fix."}' > /dev/null

curl -s "http://localhost:3000/api/v1/tickets/$T2" \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq .data.status
# Expected: "IN_PROGRESS"
```

---

## Scenario 9 — Invalid Status Transition Rejected

```bash
# Try to go directly from OPEN to CLOSED
curl -s -X PATCH "http://localhost:3000/api/v1/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CLOSED"}' | jq .error.code
# Expected: "INVALID_TRANSITION"
```

---

## Scenario 10 — Activity Log Records All Events

```bash
curl -s "http://localhost:3000/api/v1/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.activityLog | length'
```

**Expected**: Count ≥ events triggered in scenarios above (CREATED, STATUS_CHANGED ×2,
ASSIGNED, COMMENT_ADDED ×2, INTERNAL_NOTE_ADDED, etc.).

---

## Running the Test Suite

```bash
cd backend
npm run test:unit          # state machine + all use cases
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration
npm run test:contract       # all route tests
npm run test:coverage       # must show ≥ 80%
```

---

## References

- Data model: [data-model.md](data-model.md)
- Ticket contracts: [contracts/tickets.md](contracts/tickets.md)
- Comment contracts: [contracts/comments.md](contracts/comments.md)
- Category contracts: [contracts/categories.md](contracts/categories.md)
- Research: [research.md](research.md)
