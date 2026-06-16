# Quickstart Validation Guide: Notifications

**Feature**: 006-notifications
**Date**: 2026-06-16
**Depends on**: Modules 001–005 deployed and seeded; Prisma migrations for this
feature applied; SMTP relay configured (or Mailtrap/Mailhog for local testing)

---

## Prerequisites

- Modules 001–005 running; PostgreSQL migrations for 006 applied
- SMTP environment variables set (use Mailhog locally: `SMTP_HOST=localhost`,
  `SMTP_PORT=1025`, `SMTP_USER=`, `SMTP_PASS=`, `SMTP_FROM=noreply@crm.local`)
- Seed data: one Admin, one Manager, one Agent (agent@co.com), one Customer
  (jane@acme.com)
- Default notification preferences and all 20 seed templates applied by migration

```bash
# Obtain tokens
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@co.com","password":"Admin123!"}' | jq -r '.data.accessToken')

AGENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@co.com","password":"Agent123!"}' | jq -r '.data.accessToken')

CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Customer1!"}' | jq -r '.data.accessToken')

AGENT_ID=$(curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq -r '.data.id')
CUSTOMER_ID=$(curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq -r '.data.id')
```

---

## Scenario 1 — Trigger TICKET_ASSIGNED and Verify In-App Notification

This scenario verifies that assigning a ticket to an agent creates an in-app
notification visible in their inbox within 30 seconds (SC-001).

```bash
# Step 1: Customer creates a ticket
TICKET=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"App crash on login","description":"Crashes every time on iOS 17.","priority":"HIGH"}')

TICKET_ID=$(echo $TICKET | jq -r '.data.id')
REF=$(echo $TICKET | jq -r '.data.referenceNumber')
echo "Ticket: $REF ($TICKET_ID)"

# Step 2: Admin assigns the ticket to the agent
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT_ID\"}" | jq .data.assignedAgentId
# Expected: agent UUID

# Step 3: Agent polls their inbox (within 30 seconds)
curl -s "http://localhost:3000/api/v1/notifications/inbox" \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq '.data[0]'
```

**Expected**: The first inbox item has `eventType = "TICKET_ASSIGNED"`,
`ticketReference = "TKT-NNNNN"`, `isRead = false`, and a `portalLink` pointing
to the ticket. `meta.unreadCount` ≥ 1.

```bash
# Step 4: Agent opens the SSE stream in a second terminal and triggers another assignment
# (In terminal 2 — leave running)
curl -N "http://localhost:3000/api/v1/notifications/stream" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Accept: text/event-stream"
```

**Expected (terminal 2)**: When a new notification is pushed, a `data:` line
appears within 30 seconds:
```
data: {"id":"uuid","eventType":"TICKET_ASSIGNED","summary":"Ticket TKT-00001 has been assigned to you.","ticketReference":"TKT-00001","isRead":false,"createdAt":"..."}
```

---

## Scenario 2 — Disable Email for TICKET_COMMENT_ADDED; Verify No Email Sent

This scenario verifies preference-driven channel suppression (FR-003, FR-017).

```bash
# Step 1: Agent disables email for TICKET_COMMENT_ADDED
curl -s -X PUT "http://localhost:3000/api/v1/notification-preferences" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      { "eventType": "TICKET_COMMENT_ADDED", "channel": "EMAIL", "enabled": false }
    ]
  }' | jq .data
# Expected: updated preference row with enabled=false

# Step 2: Wait > 60 seconds for preference change to take effect (FR-022)
sleep 65

# Step 3: Customer adds a comment to the assigned ticket
curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Still seeing the crash after the update. Any progress?"}' | jq .data.id

# Step 4: Verify NO email was dispatched (check Mailhog/Mailtrap inbox or delivery log)
sleep 5
curl -s "http://localhost:3000/api/v1/notification-delivery-log?filter[eventType]=TICKET_COMMENT_ADDED&filter[recipientId]=$AGENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | select(.channel == "EMAIL") | .status'
```

**Expected**: No `EMAIL` channel entries, OR all matching entries have
`status = "SUPPRESSED"` (disabled preference). The agent's Mailhog inbox shows
no email for this comment event.

```bash
# Step 5: Re-enable and verify email IS sent on the next comment
curl -s -X PUT "http://localhost:3000/api/v1/notification-preferences" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      { "eventType": "TICKET_COMMENT_ADDED", "channel": "EMAIL", "enabled": true }
    ]
  }' | jq .data

sleep 65  # wait for preference propagation

curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Following up — still blocked."}' > /dev/null

# Check Mailhog — expect one new email to agent within 5 minutes
```

---

## Scenario 3 — Update Email Template and Verify Rendered in Subsequent Notification

This scenario verifies admin template editing and publish flow (FR-024–FR-028).

```bash
# Step 1: List templates to find the TICKET_ASSIGNED EMAIL template ID
TMPL_ID=$(curl -s "http://localhost:3000/api/v1/notification-templates?eventType=TICKET_ASSIGNED&channel=EMAIL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data[0].id')
echo "Template: $TMPL_ID"

# Step 2: Preview current template with sample data
curl -s -X POST "http://localhost:3000/api/v1/notification-templates/$TMPL_ID/preview" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.data.renderedBody'
# Expected: template body rendered with sample data placeholders

# Step 3: Update template — add a custom greeting
curl -s -X PUT "http://localhost:3000/api/v1/notification-templates/$TMPL_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectTemplate": "[CRM] Ticket {{ticketReference}} assigned to you",
    "bodyTemplate": "Hello {{agentName}},\n\nTicket {{ticketReference}} (\"{{ticketTitle}}\") has been assigned to you.\n\nView it here: {{portalLink}}\n\nBest regards,\nSupport Team"
  }' | jq '.data.lastModifiedAt'
# Expected: timestamp of the update; no validation error

# Step 4: Preview the new template
curl -s -X POST "http://localhost:3000/api/v1/notification-templates/$TMPL_ID/preview" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.data.renderedBody'
# Expected: "Hello Sample Agent, Ticket TKT-SAMPLE (\"Sample Ticket Title\") has been assigned..."

# Step 5: Wait >10 seconds, then trigger a new TICKET_ASSIGNED event
sleep 15
T2=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Second issue","description":"Details."}' | jq -r '.data.id')

curl -s -X POST "http://localhost:3000/api/v1/tickets/$T2/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT_ID\"}" > /dev/null

# Check Mailhog — the email should contain the updated greeting and subject
```

**Expected**: The dispatched email subject contains `[CRM] Ticket TKT-NNNNN assigned to you`
and the body contains `Hello <agent name>,...`. The previous default subject is
not used.

```bash
# Step 6: Verify previous template is retained
curl -s "http://localhost:3000/api/v1/notification-templates/$TMPL_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{prev: .data.previousBodyTemplate, current: .data.bodyTemplate}'
# Expected: previousBodyTemplate = original content; bodyTemplate = updated content
```

---

## Scenario 4 — Invalid Email: 3 Retry Attempts Logged; Admin Manual Retry

This scenario verifies retry logic, delivery log, and admin manual retry (FR-014,
FR-015, FR-030–FR-032).

```bash
# Step 1: Temporarily set the agent's email to a known-invalid address
# (Simulate by pointing SMTP host to a test server that rejects delivery
#  for addresses matching *@invalid.example.com — configure in Mailhog or use a
#  dedicated invalid relay. In a real test: update the user's email via the
#  user-auth admin endpoint to "agent-bad@invalid.example.com")
curl -s -X PATCH "http://localhost:3000/api/v1/users/$AGENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"agent-bad@invalid.example.com"}' | jq .data.email

# Step 2: Trigger a TICKET_ASSIGNED event
T3=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Third issue for retry test","description":"Details."}' | jq -r '.data.id')

NOTIF_ID=$(curl -s -X POST "http://localhost:3000/api/v1/tickets/$T3/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT_ID\"}" > /dev/null
# Notification is now PENDING; first attempt fires immediately (attempt 1 → FAILED)

# Step 3: Wait for retries (attempt 2 at +5min, attempt 3 at +15min, final FAILED at +60min)
# For testing, you can manually advance time or reduce retry intervals via env var.
# Poll the delivery log:
sleep 10
NOTIF=$(curl -s "http://localhost:3000/api/v1/notification-delivery-log?filter[sourceEntityId]=$T3&filter[channel]=EMAIL" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo $NOTIF | jq '.data[0] | {status, attemptCount, attempts: [.deliveryAttempts[] | {number: .attemptNumber, status: .status, reason: .errorReason}]}'
```

**Expected after all 3 attempts fail**:
```json
{
  "status": "FAILED",
  "attemptCount": 3,
  "attempts": [
    { "number": 1, "status": "FAILED", "reason": "Mailbox not found: agent-bad@invalid.example.com" },
    { "number": 2, "status": "FAILED", "reason": "Mailbox not found: agent-bad@invalid.example.com" },
    { "number": 3, "status": "FAILED", "reason": "Mailbox not found: agent-bad@invalid.example.com" }
  ]
}
```

```bash
# Step 4: Fix the agent's email, then admin manually retries
curl -s -X PATCH "http://localhost:3000/api/v1/users/$AGENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@co.com"}' | jq .data.email

NOTIF_ID=$(echo $NOTIF | jq -r '.data[0].id')
curl -s -X POST "http://localhost:3000/api/v1/notification-delivery-log/$NOTIF_ID/retry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data.status
# Expected: "SENT" (or "PENDING" if the retry is queued for async dispatch)

# Step 5: Verify attempt 4 in the log
curl -s "http://localhost:3000/api/v1/notification-delivery-log?filter[sourceEntityId]=$T3&filter[channel]=EMAIL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[0].deliveryAttempts | length'
# Expected: 4

# Step 6: Attempt to retry a SUPPRESSED notification — must be rejected
# (Deactivate a test user, trigger an event for them, then try admin retry)
curl -s -X POST "http://localhost:3000/api/v1/notification-delivery-log/<suppressed-notif-id>/retry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .error.code
# Expected: "RETRY_SUPPRESSED_FORBIDDEN"
```

---

## Bonus: Quiet Hours Held Then Released

```bash
# Set quiet hours 23:00-07:00 America/New_York on agent
curl -s -X PUT "http://localhost:3000/api/v1/notification-preferences" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      {
        "eventType": "TICKET_COMMENT_ADDED",
        "channel": "EMAIL",
        "enabled": true,
        "quietHoursStart": "23:00",
        "quietHoursEnd": "07:00",
        "quietHoursTimezone": "America/New_York"
      }
    ]
  }' | jq .data

# Trigger a TICKET_COMMENT_ADDED event during the quiet window
# (simulate by running the test at that local time or mock clock in integration test)

# Verify notification is PENDING with scheduledFor = next 07:00 America/New_York in UTC
curl -s "http://localhost:3000/api/v1/notification-delivery-log?filter[channel]=EMAIL&filter[status]=PENDING" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[0] | {status, scheduledFor}'
# Expected: status="PENDING", scheduledFor = next 07:00 ET in UTC

# After the quiet window ends, ProcessQuietHoursQueueJob releases the notification
# Verify it transitions to SENT
```

---

## Running the Test Suite

```bash
cd backend

# Unit tests — use cases, services (no DB)
npm run test:unit

# Integration tests — Prisma repositories against test DB
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration

# Contract tests — all 5 route files via Supertest
npm run test:contract

# Coverage gate (must show ≥ 80%)
npm run test:coverage
```

---

## References

- Data model: [data-model.md](data-model.md)
- Design decisions: [research.md](research.md)
- Inbox & stream contracts: [contracts/notifications.md](contracts/notifications.md)
- Preference contracts: [contracts/notification-preferences.md](contracts/notification-preferences.md)
- Template & delivery log contracts: [contracts/notification-templates.md](contracts/notification-templates.md)
