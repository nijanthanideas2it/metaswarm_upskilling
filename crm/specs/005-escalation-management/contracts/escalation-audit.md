# API Contracts: Escalation Audit Log

**Feature**: 005-escalation-management
**Date**: 2026-06-16
**Base path**: `/api/v1/escalation-audit`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

---

## GET /api/v1/escalation-audit

System-wide chronological audit log of all escalation and de-escalation events
across all tickets. Supports filtering by date range, event type, and policy.
Used by Admins for pattern analysis (spec US-5 / FR-032).

**Permitted roles**: `ADMIN` only

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 50 | Max 200 |
| `filter[type]` | string | — | `AUTO`, `MANUAL`, `DE_ESCALATION`; can be repeated for OR |
| `filter[policyId]` | UUID | — | Show only events triggered by this policy |
| `filter[ticketId]` | UUID | — | Show only events for this ticket |
| `filter[escalatedById]` | UUID | — | Show only manual escalations by this user |
| `filter[fromDate]` | ISO 8601 | — | Inclusive start of date range (UTC) |
| `filter[toDate]` | ISO 8601 | — | Inclusive end of date range (UTC) |
| `sort` | string | `-createdAt` | `createdAt`, `-createdAt` |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "c9d8e7f6-a5b4-3210-fedc-ba9876543210",
      "eventType": "ESCALATION",
      "escalationType": "MANUAL",
      "ticket": {
        "id": "uuid-of-ticket",
        "referenceNumber": "TKT-00042",
        "title": "Billing system down",
        "status": "IN_PROGRESS",
        "priority": "CRITICAL",
        "customerName": "Jane Smith"
      },
      "policy": null,
      "tier": null,
      "reason": "Billing dispute requires manager sign-off; involves a refund > $500.",
      "escalatedBy": {
        "id": "uuid-of-agent",
        "name": "Test Agent",
        "role": "SUPPORT_AGENT"
      },
      "targets": [
        {
          "recipientId": "uuid-of-manager",
          "recipientName": "On-Call Manager",
          "skipped": false,
          "skipReason": null
        }
      ],
      "resolutionNote": null,
      "createdAt": "2026-06-16T14:30:00Z"
    },
    {
      "id": "b8c7d6e5-f4a3-2109-edcb-a98765432109",
      "eventType": "ESCALATION",
      "escalationType": "AUTO",
      "ticket": {
        "id": "uuid-of-ticket-2",
        "referenceNumber": "TKT-00038",
        "title": "Payment gateway error",
        "status": "OPEN",
        "priority": "CRITICAL",
        "customerName": "Acme Corp"
      },
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
      "reason": null,
      "escalatedBy": null,
      "targets": [
        {
          "recipientId": "uuid-of-manager",
          "recipientName": "On-Call Manager",
          "skipped": false,
          "skipReason": null
        },
        {
          "recipientId": "uuid-of-deactivated-user",
          "recipientName": "Former Manager",
          "skipped": true,
          "skipReason": "USER_DEACTIVATED"
        }
      ],
      "resolutionNote": null,
      "createdAt": "2026-06-16T12:05:00Z"
    },
    {
      "id": "d1e2f3a4-b5c6-7890-abcd-123456789012",
      "eventType": "DE_ESCALATION",
      "escalationType": null,
      "ticket": {
        "id": "uuid-of-ticket",
        "referenceNumber": "TKT-00042",
        "title": "Billing system down",
        "status": "IN_PROGRESS",
        "priority": "CRITICAL",
        "customerName": "Jane Smith"
      },
      "policy": null,
      "tier": null,
      "reason": null,
      "escalatedBy": null,
      "targets": [],
      "resolutionNote": "Refund of $520 approved by Finance. Customer contacted and satisfied. Monitoring for 24h.",
      "performedBy": {
        "id": "uuid-of-manager",
        "name": "Test Manager",
        "role": "SUPPORT_MANAGER"
      },
      "createdAt": "2026-06-16T15:00:00Z"
    }
  ],
  "meta": {
    "total": 847,
    "page": 1,
    "pageSize": 50,
    "hasNextPage": true,
    "appliedFilters": {
      "fromDate": null,
      "toDate": null,
      "type": null,
      "policyId": null
    }
  },
  "error": null
}
```

> **Field reference**:
> - `eventType` — `"ESCALATION"` or `"DE_ESCALATION"` — top-level discriminator
> - `escalationType` — `"AUTO"` or `"MANUAL"` when `eventType = ESCALATION`; `null` for de-escalation events
> - `escalatedBy` — present on MANUAL escalation events; `null` for AUTO and DE_ESCALATION
> - `performedBy` — present on DE_ESCALATION events; `null` for escalation events
> - `resolutionNote` — present on DE_ESCALATION events; `null` for escalation events
> - `reason` — present on MANUAL escalation events; `null` for AUTO and DE_ESCALATION

**403 Forbidden** — Non-admin caller:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "FORBIDDEN", "message": "Access to the escalation audit log requires Admin role.", "details": null }
}
```

**422 Unprocessable** — Invalid date range (fromDate after toDate):
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "fromDate must not be after toDate.", "details": null }
}
```

---

## GET /api/v1/escalation-audit/summary

Aggregate statistics for the escalation audit log over a date range. Used by
Admins to identify high-fire policies and escalation trends.

**Permitted roles**: `ADMIN` only

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter[fromDate]` | ISO 8601 | 30 days ago | Inclusive start |
| `filter[toDate]` | ISO 8601 | now | Inclusive end |

### Response — 200 OK

```json
{
  "data": {
    "period": {
      "from": "2026-05-17T00:00:00Z",
      "to": "2026-06-16T23:59:59Z"
    },
    "totals": {
      "escalationEvents": 112,
      "autoEscalations": 89,
      "manualEscalations": 23,
      "deEscalationEvents": 67
    },
    "byPolicy": [
      {
        "policyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "policyName": "Critical Response",
        "tierFires": [
          { "tierOrdinal": 1, "count": 54 },
          { "tierOrdinal": 2, "count": 18 }
        ],
        "totalFires": 72
      },
      {
        "policyId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "policyName": "Unassigned Tickets",
        "tierFires": [
          { "tierOrdinal": 1, "count": 17 }
        ],
        "totalFires": 17
      }
    ],
    "byAgent": [
      {
        "agentId": "uuid-of-agent",
        "agentName": "Test Agent",
        "manualEscalations": 8
      }
    ],
    "avgTimeToDeEscalateHours": 3.4
  },
  "meta": null,
  "error": null
}
```

---

## GET /api/v1/tickets/:ticketId/escalation/events

*(Defined in [ticket-escalation.md](ticket-escalation.md))* — per-ticket event
list including both AUTO and MANUAL escalation events for the ticket.

---

## GET /api/v1/tickets/:ticketId/escalation/history

*(Defined in [ticket-escalation.md](ticket-escalation.md))* — combined
chronological history of escalation and de-escalation events for one ticket.

---

## Common Error Codes (Escalation Audit)

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Caller does not have Admin role |
| `VALIDATION_ERROR` | 422 | Invalid filter parameters (e.g., fromDate after toDate) |
| `NOT_FOUND` | 404 | Referenced policy or ticket not found |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
