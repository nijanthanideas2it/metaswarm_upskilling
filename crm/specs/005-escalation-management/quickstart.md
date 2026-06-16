# Quickstart: Escalation Management Validation

**Feature**: 005-escalation-management
**Date**: 2026-06-16
**Depends on**: modules 001–004 running and seeded; Prisma migrations for this
feature applied

---

## Prerequisites

- All preceding modules deployed; PostgreSQL 16 running with the 005 migration
  applied (`escalatedAt` column on `Ticket`; all new escalation models created)
- Seed data: one Admin, one Support Manager, one Support Agent, one Customer
- Tokens obtained:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@co.com","password":"Admin123!"}' | jq -r '.data.accessToken')

MANAGER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@co.com","password":"Manager1!"}' | jq -r '.data.accessToken')

AGENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@co.com","password":"Agent123!"}' | jq -r '.data.accessToken')

AGENT_ID=$(curl -s http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq -r '.data.id')

CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Customer1!"}' | jq -r '.data.accessToken')
```

---

## Scenario 1: Create a Policy with Two Tiers and Verify It Is Listed

**Goal**: Validate that a manager can create a complete escalation policy scoped
to CRITICAL tickets and that both tiers are returned in policy detail.

**Steps**:

```bash
# 1. Create the policy (no tiers yet — isActive remains false)
POLICY=$(curl -s -X POST http://localhost:3000/api/v1/escalation-policies \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Critical Response",
    "description": "Escalation policy for CRITICAL tickets.",
    "scopePriorities": ["CRITICAL"]
  }')

echo $POLICY | jq .
POLICY_ID=$(echo $POLICY | jq -r '.data.id')
```

```bash
# 2. Add Tier 1 — fires 4 hours after ticket creation; notifies the manager
curl -s -X POST "http://localhost:3000/api/v1/escalation-policies/$POLICY_ID/tiers" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ordinal": 1,
    "triggerCondition": "TIME_SINCE_CREATION",
    "thresholdHours": 4,
    "actions": [
      { "actionType": "NOTIFY_ROLE", "targetRole": "SUPPORT_MANAGER" }
    ]
  }' | jq .data.id
```

```bash
# 3. Add Tier 2 — fires 8 hours after creation; notifies admin + elevates priority
curl -s -X POST "http://localhost:3000/api/v1/escalation-policies/$POLICY_ID/tiers" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ordinal": 2,
    "triggerCondition": "TIME_SINCE_CREATION",
    "thresholdHours": 8,
    "actions": [
      { "actionType": "NOTIFY_ROLE", "targetRole": "ADMIN" },
      { "actionType": "ELEVATE_PRIORITY" }
    ]
  }' | jq .data.id
```

```bash
# 4. Activate the policy
curl -s -X POST "http://localhost:3000/api/v1/escalation-policies/$POLICY_ID/activate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .data.isActive
# Expected: true
```

```bash
# 5. Verify policy appears in the active list
curl -s "http://localhost:3000/api/v1/escalation-policies?filter[isActive]=true" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '[.data[] | .name]'
# Expected: ["Critical Response"]
```

```bash
# 6. Verify policy detail shows both tiers
curl -s "http://localhost:3000/api/v1/escalation-policies/$POLICY_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data.tiers | length'
# Expected: 2
```

```bash
# 7. Deactivate and confirm policy is excluded from active list
curl -s -X POST "http://localhost:3000/api/v1/escalation-policies/$POLICY_ID/deactivate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .data.isActive
# Expected: false

curl -s "http://localhost:3000/api/v1/escalation-policies?filter[isActive]=true" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '[.data[] | .name] | contains(["Critical Response"])'
# Expected: false
```

**Expected outcome**: Policy created, both tiers visible in detail, activation
toggles correctly, deactivated policy absent from active filter results.

---

## Scenario 2: Simulate Auto-Escalation by Back-Dating a Ticket

**Goal**: Validate that the evaluation job detects a threshold breach and fires
the correct tier, setting `isEscalated` and recording an `EscalationEvent`.

**Steps**:

```bash
# Re-activate the "Critical Response" policy from Scenario 1
curl -s -X POST "http://localhost:3000/api/v1/escalation-policies/$POLICY_ID/activate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" > /dev/null
```

```bash
# 1. Create a CRITICAL ticket as a customer
TICKET=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Billing system down","description":"Cannot process any payments.","priority":"CRITICAL"}')

TICKET_ID=$(echo $TICKET | jq -r '.data.id')
echo "Ticket: $TICKET_ID"
```

```bash
# 2. Back-date the ticket's createdAt to 5 hours ago via direct DB update
#    (test environment only — simulates time passing)
psql $DATABASE_URL -c \
  "UPDATE \"Ticket\" SET \"createdAt\" = NOW() - INTERVAL '5 hours' WHERE id = '$TICKET_ID';"
```

```bash
# 3. Trigger the evaluation job manually via the internal endpoint (test/admin only)
curl -s -X POST http://localhost:3000/api/v1/internal/escalation-evaluation/run \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data.tiersFireCount
# Expected: 1 (Tier 1 fired; Tier 2 threshold not yet reached)
```

```bash
# 4. Verify isEscalated flag is set on the ticket
curl -s "http://localhost:3000/api/v1/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '{isEscalated: .data.isEscalated, escalatedAt: .data.escalatedAt}'
# Expected: { "isEscalated": true, "escalatedAt": "<non-null ISO timestamp>" }
```

```bash
# 5. Verify escalation event was recorded on the ticket
curl -s "http://localhost:3000/api/v1/tickets/$TICKET_ID/escalation/events" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data[0] | {type, tierOrdinal: .tier.ordinal, policyName: .policy.name}'
# Expected: { "type": "AUTO", "tierOrdinal": 1, "policyName": "Critical Response" }
```

```bash
# 6. Run evaluation again — Tier 1 must NOT fire twice
curl -s -X POST http://localhost:3000/api/v1/internal/escalation-evaluation/run \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data.tiersFireCount
# Expected: 0 (Tier 1 already fired; Tier 2 threshold still 8h, only 5h elapsed)
```

**Expected outcome**: Ticket gains `isEscalated = true` after the first run;
`EscalationEvent` of type `AUTO` is recorded; second run produces zero new fires
for the same tier.

---

## Scenario 3: Agent Manually Escalates Their Own Ticket

**Goal**: Validate that an agent can escalate their assigned ticket with a reason,
that the flag is set immediately, and that the event appears in the audit log.

**Steps**:

```bash
# 1. Create an open ticket and assign it to the test agent
NEW_TICKET=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Complex billing dispute","description":"Customer claims double charge.","priority":"HIGH"}')

NEW_TICKET_ID=$(echo $NEW_TICKET | jq -r '.data.id')

curl -s -X POST "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/assign" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\": \"$AGENT_ID\"}" > /dev/null
```

```bash
# 2. Agent manually escalates the ticket
MANUAL_ESC=$(curl -s -X POST "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/escalation/escalate" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
    "notifyTargets": [{ "type": "ROLE", "targetRole": "SUPPORT_MANAGER" }]
  }')

echo $MANUAL_ESC | jq .
```

Expected response shape:
```json
{
  "data": {
    "eventId": "uuid",
    "ticketId": "uuid",
    "type": "MANUAL",
    "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
    "escalatedBy": { "id": "uuid", "name": "Test Agent" },
    "targets": [{ "recipientId": "uuid", "recipientName": "Test Manager", "skipped": false }],
    "createdAt": "2026-06-16T14:30:00Z"
  },
  "meta": null,
  "error": null
}
```

```bash
# 3. Confirm isEscalated is set on the ticket
curl -s "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID" \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq .data.isEscalated
# Expected: true
```

```bash
# 4. Confirm the event appears in the ticket's escalation event list
curl -s "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/escalation/events" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data[0].type'
# Expected: "MANUAL"
```

```bash
# 5. Confirm that a DIFFERENT agent cannot escalate this ticket
AGENT2_TOKEN=<second-agent-token>
curl -s -X POST "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/escalation/escalate" \
  -H "Authorization: Bearer $AGENT2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Trying to escalate someone elses ticket."}' | jq .error.code
# Expected: "FORBIDDEN"
```

```bash
# 6. Confirm that a Customer cannot escalate at all
curl -s -X POST "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/escalation/escalate" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"I want this escalated."}' | jq .error.code
# Expected: "FORBIDDEN"
```

**Expected outcome**: Agent successfully escalates their own ticket; flag set;
event recorded; unauthorized attempts rejected with `FORBIDDEN`.

---

## Scenario 4: Manager De-escalates a Ticket and Verifies Queue Removal

**Goal**: Validate that a manager can de-escalate an escalated ticket, the flag
is cleared, the ticket disappears from the escalated queue, and the de-escalation
note appears in the ticket's escalation event history.

**Steps**:

```bash
# The ticket from Scenario 3 ($NEW_TICKET_ID) is currently escalated.

# 1. Load the escalated ticket queue — ticket should be present
curl -s "http://localhost:3000/api/v1/tickets?filter[isEscalated]=true" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '[.data[] | .id] | contains(["'"$NEW_TICKET_ID"'"])'
# Expected: true
```

```bash
# 2. Verify queue sort order with multiple escalated tickets
#    (create a second CRITICAL escalated ticket for sort validation)
T2=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"System outage","description":"Full outage.","priority":"CRITICAL"}' | jq -r '.data.id')

curl -s -X POST "http://localhost:3000/api/v1/tickets/$T2/escalation/escalate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Critical outage — immediate management attention."}' > /dev/null

curl -s "http://localhost:3000/api/v1/tickets?filter[isEscalated]=true&sort=-priority,escalatedAt" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '[.data[] | {priority: .priority, title: .title}]'
# Expected: CRITICAL tickets first; within same priority, oldest escalation time first
```

```bash
# 3. Manager de-escalates the ticket from Scenario 3
DE_ESC=$(curl -s -X POST "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/escalation/de-escalate" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolutionNote":"Refund approved by finance. Manager spoke with customer. Issue resolved."}')

echo $DE_ESC | jq .
```

Expected response shape:
```json
{
  "data": {
    "eventId": "uuid",
    "ticketId": "uuid",
    "performedBy": { "id": "uuid", "name": "Test Manager" },
    "resolutionNote": "Refund approved by finance. Manager spoke with customer. Issue resolved.",
    "createdAt": "2026-06-16T15:00:00Z",
    "ticket": { "id": "uuid", "isEscalated": false, "status": "IN_PROGRESS" }
  },
  "meta": null,
  "error": null
}
```

```bash
# 4. Confirm isEscalated is now false on the ticket
curl -s "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '{isEscalated: .data.isEscalated, status: .data.status}'
# Expected: { "isEscalated": false, "status": "IN_PROGRESS" }
# (status is unchanged — de-escalation does not modify ticket status; FR-025)
```

```bash
# 5. Confirm ticket no longer appears in the escalated queue
curl -s "http://localhost:3000/api/v1/tickets?filter[isEscalated]=true" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '[.data[] | .id] | contains(["'"$NEW_TICKET_ID"'"])'
# Expected: false
```

```bash
# 6. Confirm de-escalation note appears in the per-ticket audit history
curl -s "http://localhost:3000/api/v1/tickets/$NEW_TICKET_ID/escalation/history" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '[.data[] | {eventType: .eventType, note: .resolutionNote}]'
# Expected: array includes an entry with eventType "DE_ESCALATION"
#           and resolutionNote "Refund approved by finance..."
```

```bash
# 7. Confirm an Agent cannot de-escalate
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T2/escalation/de-escalate" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolutionNote":"I think this is fine now."}' | jq .error.code
# Expected: "FORBIDDEN"
```

**Expected outcome**: De-escalation removes the flag and the ticket from the
queue; ticket status is unchanged; de-escalation note persisted in audit history;
agent de-escalation attempt rejected.

---

## Running the Test Suite

```bash
cd backend
npm run test:unit          # evaluation logic, RBAC, state machine
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration
npm run test:contract       # all escalation route tests
npm run test:coverage       # must show >= 80% lines + branches
```

---

## References

- Data model: [data-model.md](data-model.md)
- Research decisions: [research.md](research.md)
- Policy contracts: [contracts/escalation-policies.md](contracts/escalation-policies.md)
- Ticket escalation contracts: [contracts/ticket-escalation.md](contracts/ticket-escalation.md)
- Audit log contracts: [contracts/escalation-audit.md](contracts/escalation-audit.md)
