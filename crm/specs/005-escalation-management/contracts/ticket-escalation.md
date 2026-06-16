# API Contracts: Ticket Escalation

**Feature**: 005-escalation-management
**Date**: 2026-06-16
**Base path**: `/api/v1/tickets/:ticketId/escalation`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

---

## POST /api/v1/tickets/:ticketId/escalation/escalate

Manually escalates a ticket. The ticket's `isEscalated` flag is set immediately.
An `EscalationEvent` of type `MANUAL` is written to the DB in the same transaction
as the flag update and the `TicketActivityLogEntry`.

**Permitted roles**:
- `SUPPORT_AGENT` — own assigned tickets only
- `SUPPORT_MANAGER` — any ticket
- `ADMIN` — any ticket
- `CUSTOMER` — forbidden (FR-016)

### Request

```json
{
  "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
  "notifyTargets": [
    { "type": "USER", "targetUserId": "uuid-of-on-call-manager" },
    { "type": "ROLE", "targetRole": "SUPPORT_MANAGER" }
  ]
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `reason` | string | Yes | 1–1,000 chars; must be non-empty (FR-014) |
| `notifyTargets` | array | No | 0+ targets; empty array = escalate with no additional notifications |
| `notifyTargets[].type` | string | Yes | `USER` or `ROLE` |
| `notifyTargets[].targetUserId` | UUID | Conditional | Required when `type = USER` |
| `notifyTargets[].targetRole` | string | Conditional | Required when `type = ROLE`; `SUPPORT_MANAGER` or `ADMIN` |

### Response — 200 OK

```json
{
  "data": {
    "eventId": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
    "ticketId": "uuid-of-ticket",
    "type": "MANUAL",
    "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
    "escalatedBy": {
      "id": "uuid-of-agent",
      "name": "Test Agent"
    },
    "targets": [
      {
        "recipientId": "uuid-of-on-call-manager",
        "recipientName": "On-Call Manager",
        "skipped": false,
        "skipReason": null
      },
      {
        "recipientId": "uuid-of-another-manager",
        "recipientName": "Team Manager",
        "skipped": false,
        "skipReason": null
      }
    ],
    "ticket": {
      "id": "uuid-of-ticket",
      "referenceNumber": "TKT-00042",
      "isEscalated": true,
      "escalatedAt": "2026-06-16T14:30:00Z"
    },
    "createdAt": "2026-06-16T14:30:00Z"
  },
  "meta": null,
  "error": null
}
```

> **Note**: When a `NOTIFY_ROLE` target resolves to multiple users, each user
> appears as a separate entry in `targets`. Deactivated users are included with
> `skipped: true` and `skipReason: "USER_DEACTIVATED"`.

**403 Forbidden** — Agent attempting to escalate a ticket not assigned to them:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "FORBIDDEN", "message": "You may only escalate tickets assigned to you.", "details": null }
}
```

**403 Forbidden** — Customer attempting to escalate:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "FORBIDDEN", "message": "Customers cannot escalate tickets.", "details": null }
}
```

**422 Unprocessable** — Empty reason:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed.", "details": [{ "field": "reason", "issue": "Reason must not be empty." }] }
}
```

**409 Conflict** — Ticket is in a terminal state (CLOSED or CANCELLED):
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "TICKET_TERMINAL", "message": "Cannot escalate a CLOSED or CANCELLED ticket.", "details": null }
}
```

---

## POST /api/v1/tickets/:ticketId/escalation/de-escalate

Removes the escalated flag from a ticket. A resolution note is mandatory. The
`Ticket.isEscalated` is set to `false` and `Ticket.escalatedAt` is nulled in the
same Prisma transaction as the `DeEscalationEvent` write and activity log entry.
Ticket status is NOT changed (FR-025).

**Permitted roles**: `SUPPORT_MANAGER`, `ADMIN` (agents are forbidden — FR-023 / FR-024)

### Request

```json
{
  "resolutionNote": "Refund of $520 approved by Finance. Customer contacted and satisfied. Monitoring for 24h."
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `resolutionNote` | string | Yes | 1–1,000 chars; must be non-empty (FR-023) |

### Response — 200 OK

```json
{
  "data": {
    "eventId": "d1e2f3a4-b5c6-7890-abcd-123456789012",
    "ticketId": "uuid-of-ticket",
    "performedBy": {
      "id": "uuid-of-manager",
      "name": "Test Manager"
    },
    "resolutionNote": "Refund of $520 approved by Finance. Customer contacted and satisfied. Monitoring for 24h.",
    "ticket": {
      "id": "uuid-of-ticket",
      "referenceNumber": "TKT-00042",
      "isEscalated": false,
      "escalatedAt": null,
      "status": "IN_PROGRESS"
    },
    "createdAt": "2026-06-16T15:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Agent or Customer attempting to de-escalate:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "FORBIDDEN", "message": "Only Support Managers and Admins may de-escalate tickets.", "details": null }
}
```

**409 Conflict** — Ticket is not currently escalated:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "TICKET_NOT_ESCALATED", "message": "This ticket is not currently escalated.", "details": null }
}
```

**422 Unprocessable** — Empty resolution note:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed.", "details": [{ "field": "resolutionNote", "issue": "Resolution note must not be empty." }] }
}
```

---

## GET /api/v1/tickets/:ticketId/escalation/state

Returns the current escalation state of a ticket — whether it is escalated, when
it was escalated, and which policy tier ordinals have already fired per policy.

**Permitted roles**: Admin, Support Manager, Support Agent (own assigned tickets
or any unassigned); Customer — forbidden (FR-021)

### Response — 200 OK (escalated ticket)

```json
{
  "data": {
    "ticketId": "uuid-of-ticket",
    "referenceNumber": "TKT-00042",
    "isEscalated": true,
    "escalatedAt": "2026-06-16T14:30:00Z",
    "policyStates": [
      {
        "policyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "policyName": "Critical Response",
        "firedTierOrdinals": [1],
        "pendingTierOrdinals": [2]
      }
    ]
  },
  "meta": null,
  "error": null
}
```

### Response — 200 OK (non-escalated ticket)

```json
{
  "data": {
    "ticketId": "uuid-of-ticket",
    "referenceNumber": "TKT-00099",
    "isEscalated": false,
    "escalatedAt": null,
    "policyStates": []
  },
  "meta": null,
  "error": null
}
```

---

## GET /api/v1/tickets/:ticketId/escalation/events

Returns all escalation events for a specific ticket, in reverse chronological
order (newest first).

**Permitted roles**: Admin, Support Manager, Support Agent; Customer — forbidden

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 20 | Max 100 |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
      "type": "MANUAL",
      "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
      "policy": null,
      "tier": null,
      "escalatedBy": {
        "id": "uuid-of-agent",
        "name": "Test Agent"
      },
      "targets": [
        {
          "recipientId": "uuid-of-manager",
          "recipientName": "On-Call Manager",
          "skipped": false,
          "skipReason": null
        }
      ],
      "createdAt": "2026-06-16T14:30:00Z"
    },
    {
      "id": "b8c7d6e5-f4a3-2109-edcb-a98765432109",
      "type": "AUTO",
      "reason": null,
      "policy": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "Critical Response"
      },
      "tier": {
        "id": "tier-uuid-1",
        "ordinal": 1,
        "triggerCondition": "TIME_SINCE_CREATION",
        "thresholdHours": 4
      },
      "escalatedBy": null,
      "targets": [
        {
          "recipientId": "uuid-of-manager",
          "recipientName": "On-Call Manager",
          "skipped": false,
          "skipReason": null
        }
      ],
      "createdAt": "2026-06-16T14:00:00Z"
    }
  ],
  "meta": { "total": 2, "page": 1, "pageSize": 20, "hasNextPage": false },
  "error": null
}
```

---

## GET /api/v1/tickets/:ticketId/escalation/history

Returns the combined chronological history for a ticket: escalation events
AND de-escalation events, sorted oldest first. Used for the ticket detail
activity view (spec US-4 / FR-030, FR-031).

**Permitted roles**: Admin, Support Manager, Support Agent; Customer — forbidden

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 50 | Max 100 |

### Response — 200 OK

```json
{
  "data": [
    {
      "eventType": "ESCALATION",
      "id": "b8c7d6e5-f4a3-2109-edcb-a98765432109",
      "type": "AUTO",
      "policyName": "Critical Response",
      "tierOrdinal": 1,
      "reason": null,
      "actor": null,
      "targets": ["On-Call Manager"],
      "resolutionNote": null,
      "createdAt": "2026-06-16T14:00:00Z"
    },
    {
      "eventType": "ESCALATION",
      "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
      "type": "MANUAL",
      "policyName": null,
      "tierOrdinal": null,
      "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
      "actor": { "id": "uuid-of-agent", "name": "Test Agent" },
      "targets": ["On-Call Manager", "Team Manager"],
      "resolutionNote": null,
      "createdAt": "2026-06-16T14:30:00Z"
    },
    {
      "eventType": "DE_ESCALATION",
      "id": "d1e2f3a4-b5c6-7890-abcd-123456789012",
      "type": null,
      "policyName": null,
      "tierOrdinal": null,
      "reason": null,
      "actor": { "id": "uuid-of-manager", "name": "Test Manager" },
      "targets": [],
      "resolutionNote": "Refund of $520 approved by Finance. Customer contacted and satisfied. Monitoring for 24h.",
      "createdAt": "2026-06-16T15:00:00Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "pageSize": 50, "hasNextPage": false },
  "error": null
}
```

---

## Common Error Codes (Ticket Escalation)

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Role or ownership check failed |
| `TICKET_NOT_ESCALATED` | 409 | De-escalate called on non-escalated ticket |
| `TICKET_TERMINAL` | 409 | Escalation attempted on CLOSED or CANCELLED ticket |
| `NOT_FOUND` | 404 | Ticket ID not found |
| `VALIDATION_ERROR` | 422 | Request body schema failure |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
