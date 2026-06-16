# API Contracts: Notification Templates, Delivery Log & Admin Retry

**Feature**: 006-notifications
**Date**: 2026-06-16
**Base paths**: `/api/v1/notification-templates`, `/api/v1/notification-delivery-log`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

---

## NOTIFICATION TEMPLATES

---

## GET /api/v1/notification-templates

Returns all notification templates grouped by event type. There are always
exactly 20 templates (10 event types × 2 channels). No pagination.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `eventType` | string | Filter to a specific event type |
| `channel` | string | `IN_APP` or `EMAIL` |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "channel": "EMAIL",
      "subjectTemplate": "Ticket {{ticketReference}} has been assigned to you",
      "bodyTemplate": "Hello {{agentName}},\n\nTicket {{ticketReference}} (\"{{ticketTitle}}\") has been assigned to you.\n\nView it here: {{portalLink}}",
      "previousSubjectTemplate": null,
      "previousBodyTemplate": null,
      "lastModifiedById": null,
      "lastModifiedAt": null,
      "updatedAt": "2026-06-16T00:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "channel": "IN_APP",
      "subjectTemplate": null,
      "bodyTemplate": "Ticket {{ticketReference}} has been assigned to you.",
      "previousSubjectTemplate": null,
      "previousBodyTemplate": null,
      "lastModifiedById": "uuid-of-admin",
      "lastModifiedAt": "2026-06-16T09:00:00Z",
      "updatedAt": "2026-06-16T09:00:00Z"
    }
  ],
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Caller is not Admin or Manager.

---

## GET /api/v1/notification-templates/:id

Returns the full detail of a single template including previous version fields.

**Permitted roles**: Admin, Support Manager

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "eventType": "TICKET_ESCALATED",
    "channel": "EMAIL",
    "subjectTemplate": "URGENT: Ticket {{ticketReference}} has been escalated",
    "bodyTemplate": "Hello {{agentName}},\n\nTicket {{ticketReference}} (\"{{ticketTitle}}\") has been escalated.\n\nReason: {{escalationReason}}\nTime elapsed: {{timeElapsed}}\n\nView it here: {{portalLink}}\n\nPlease take immediate action.",
    "previousSubjectTemplate": "Ticket {{ticketReference}} escalated",
    "previousBodyTemplate": "Ticket {{ticketReference}} has been escalated. View: {{portalLink}}",
    "lastModifiedById": "uuid-of-admin",
    "lastModifiedAt": "2026-06-16T10:00:00Z",
    "requiredVariables": ["ticketReference", "escalationReason", "agentName", "ticketTitle", "timeElapsed", "portalLink"],
    "createdAt": "2026-06-16T00:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

`requiredVariables` — read-only list of variable names that MUST be present in
`bodyTemplate` (and `subjectTemplate` for EMAIL) to pass save validation. Derived
from the static `REQUIRED_VARIABLES` map in the Application layer.

**403 Forbidden** | **404 Not Found**

---

## PUT /api/v1/notification-templates/:id

Updates the content of a template. Validates required variables before saving.
Copies current content to `previous*` fields before overwriting. Changes take
effect for notifications dispatched more than 10 seconds after the update (FR-028).

**Permitted roles**: Admin only

### Request

```json
{
  "subjectTemplate": "[CRM] URGENT: Ticket {{ticketReference}} escalated — immediate action required",
  "bodyTemplate": "Hello {{agentName}},\n\nTicket {{ticketReference}} (\"{{ticketTitle}}\") requires your immediate attention.\n\nEscalation reason: {{escalationReason}}\nTime since creation: {{timeElapsed}}\n\nView and respond here: {{portalLink}}\n\nThis notification bypasses quiet hours."
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `subjectTemplate` | string | EMAIL only | 1–500 chars; must contain all required subject variables |
| `bodyTemplate` | string | Yes | 1–10,000 chars; must contain all required body variables |

Both fields are optional in the payload (partial update). If `subjectTemplate`
is omitted, only `bodyTemplate` is updated (and vice versa). At least one field
must be supplied.

For `IN_APP` templates, `subjectTemplate` is always `null` and must not be
supplied.

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "eventType": "TICKET_ESCALATED",
    "channel": "EMAIL",
    "subjectTemplate": "[CRM] URGENT: Ticket {{ticketReference}} escalated — immediate action required",
    "bodyTemplate": "Hello {{agentName}},\n\nTicket {{ticketReference}}...",
    "previousSubjectTemplate": "URGENT: Ticket {{ticketReference}} has been escalated",
    "previousBodyTemplate": "Hello {{agentName}},\n\nTicket {{ticketReference}}...(prior content)",
    "lastModifiedById": "uuid-of-admin",
    "lastModifiedAt": "2026-06-16T11:00:00Z",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**422 Validation Error** — Required variable missing from template body or subject:
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "MISSING_REQUIRED_VARIABLES",
    "message": "Template is missing required variables.",
    "details": {
      "missingVariables": ["escalationReason", "timeElapsed"],
      "requiredVariables": ["ticketReference", "escalationReason", "agentName", "ticketTitle", "timeElapsed", "portalLink"]
    }
  }
}
```

**403 Forbidden** — Caller is not Admin.

**404 Not Found** — Template ID not found.

---

## POST /api/v1/notification-templates/:id/preview

Renders the template with representative sample data and returns the rendered
output. Does NOT modify the template. Useful for verifying variable substitution
before publishing.

**Permitted roles**: Admin, Support Manager

### Request — empty body or optional sample variable overrides

```json
{
  "sampleData": {
    "agentName": "Priya Sharma",
    "ticketReference": "TKT-00099",
    "ticketTitle": "Cannot access billing portal",
    "escalationReason": "SLA breach — response overdue by 4 hours",
    "timeElapsed": "8h 12m",
    "portalLink": "https://crm.example.com/tickets/uuid"
  }
}
```

If `sampleData` is omitted or partially provided, the system fills missing
variables from the built-in sample dataset for that event type.

### Response — 200 OK

```json
{
  "data": {
    "eventType": "TICKET_ESCALATED",
    "channel": "EMAIL",
    "renderedSubject": "[CRM] URGENT: Ticket TKT-00099 escalated — immediate action required",
    "renderedBody": "Hello Priya Sharma,\n\nTicket TKT-00099 (\"Cannot access billing portal\") requires your immediate attention.\n\nEscalation reason: SLA breach — response overdue by 4 hours\nTime since creation: 8h 12m\n\nView and respond here: https://crm.example.com/tickets/uuid\n\nThis notification bypasses quiet hours.",
    "missingVariables": []
  },
  "meta": null,
  "error": null
}
```

`missingVariables` — array of variable names that appeared in the template but
were not present in the provided `sampleData` or built-in sample dataset, and
thus rendered as empty strings. Non-empty array is a warning, not an error —
preview proceeds regardless.

**403 Forbidden** | **404 Not Found**

---

## NOTIFICATION DELIVERY LOG

---

## GET /api/v1/notification-delivery-log

Returns a paginated, filterable list of all notification delivery records.
Admin-only view for operational troubleshooting (SC-007: loads ≤ 5 s for 30-day
window; appropriate composite index required).

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 20 | Min 1, max 100 |
| `filter[ticketReference]` | string | — | e.g. `TKT-00042`; resolves to `sourceEntityId` via join |
| `filter[sourceEntityId]` | UUID | — | Direct filter on `NotificationEvent.sourceEntityId` |
| `filter[recipientId]` | UUID | — | Filter by recipient user ID |
| `filter[eventType]` | string | — | One of the 10 event type values |
| `filter[channel]` | string | — | `IN_APP` or `EMAIL` |
| `filter[status]` | string | — | `PENDING`, `SENT`, `FAILED`, or `SUPPRESSED` |
| `filter[dateFrom]` | ISO 8601 | — | Notifications created at or after this datetime |
| `filter[dateTo]` | ISO 8601 | — | Notifications created at or before this datetime |
| `sort` | string | `-createdAt` | `createdAt`, `-createdAt` |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "channel": "EMAIL",
      "status": "FAILED",
      "recipientId": "uuid",
      "recipientName": "Bob Agent",
      "recipientEmail": "agent-bad@invalid.example.com",
      "ticketReference": "TKT-00042",
      "sourceEntityId": "uuid-of-ticket",
      "attemptCount": 3,
      "scheduledFor": null,
      "nextRetryAt": null,
      "createdAt": "2026-06-16T10:00:00Z",
      "updatedAt": "2026-06-16T11:05:00Z",
      "deliveryAttempts": [
        {
          "id": "uuid",
          "attemptNumber": 1,
          "status": "FAILED",
          "errorReason": "Mailbox not found: agent-bad@invalid.example.com",
          "attemptedAt": "2026-06-16T10:00:05Z"
        },
        {
          "id": "uuid",
          "attemptNumber": 2,
          "status": "FAILED",
          "errorReason": "Mailbox not found: agent-bad@invalid.example.com",
          "attemptedAt": "2026-06-16T10:05:10Z"
        },
        {
          "id": "uuid",
          "attemptNumber": 3,
          "status": "FAILED",
          "errorReason": "Mailbox not found: agent-bad@invalid.example.com",
          "attemptedAt": "2026-06-16T10:20:12Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 234,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true
  },
  "error": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | `Notification.id` |
| `eventType` | string | Event that triggered the notification |
| `channel` | string | `IN_APP` or `EMAIL` |
| `status` | string | Current delivery status |
| `recipientId` | UUID | User ID of the intended recipient |
| `recipientName` | string | Full name at time of query |
| `recipientEmail` | string | Email address at time of query (EMAIL channel) |
| `ticketReference` | string | Resolved from `NotificationEvent.sourceEntityId` |
| `sourceEntityId` | UUID | Source ticket ID |
| `attemptCount` | int | Total number of delivery attempts made |
| `scheduledFor` | ISO 8601 / null | Set when held for quiet hours |
| `nextRetryAt` | ISO 8601 / null | Set when pending a retry |
| `deliveryAttempts` | array | Inline array of all attempt records (max 4) |

**403 Forbidden** — Caller is not Admin or Manager.

**422 Validation Error** — Invalid query parameter value.

---

## GET /api/v1/notification-delivery-log/:id

Returns the full detail of a single notification delivery record including all
attempt log entries.

**Permitted roles**: Admin, Support Manager

### Response — 200 OK

Same shape as a single item from the list response.

**403 Forbidden** | **404 Not Found**

---

## POST /api/v1/notification-delivery-log/:id/retry

Triggers one additional delivery attempt on a `FAILED` notification. The
recipient's current email address (at retry time) is used — not the address
at the time of the original event (spec edge case). Retrying a `SUPPRESSED`
notification is rejected. Only EMAIL channel notifications are eligible for
retry.

**Permitted roles**: Admin only

### Request — empty body

### Response — 200 OK

The notification has been queued for immediate dispatch (async). The response
reflects the updated status at the time of the response — `status` may be
`PENDING` if dispatch is asynchronous, or `SENT`/`FAILED` if the attempt
completed synchronously.

```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "attemptCount": 4,
    "nextRetryAt": null,
    "updatedAt": "2026-06-16T14:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**409 Conflict** — Notification is not in `FAILED` status (e.g., still `PENDING`
or already `SENT`):
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "INVALID_RETRY_STATUS",
    "message": "Only FAILED notifications can be retried.",
    "details": { "currentStatus": "PENDING" }
  }
}
```

**422 Unprocessable Entity** — Notification is `SUPPRESSED` (deactivated recipient):
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "RETRY_SUPPRESSED_FORBIDDEN",
    "message": "Cannot retry a notification for a deactivated user.",
    "details": null
  }
}
```

**422 Unprocessable Entity** — IN_APP channel notification (retry not applicable):
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "RETRY_CHANNEL_INVALID",
    "message": "Retry is only available for EMAIL channel notifications.",
    "details": null
  }
}
```

**403 Forbidden** — Caller is not Admin.

**404 Not Found** — Notification ID not found.

---

## Common Error Codes (Templates & Delivery Log)

| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_REQUIRED_VARIABLES` | 422 | Template save rejected — required placeholders missing |
| `INVALID_RETRY_STATUS` | 409 | Retry attempted on a non-FAILED notification |
| `RETRY_SUPPRESSED_FORBIDDEN` | 422 | Retry attempted on a SUPPRESSED (deactivated user) notification |
| `RETRY_CHANNEL_INVALID` | 422 | Retry attempted on an IN_APP channel notification |
| `FORBIDDEN` | 403 | Insufficient role for the operation |
| `NOT_FOUND` | 404 | Resource ID not found |
| `VALIDATION_ERROR` | 422 | Request body or query parameter schema failure |
| `UNAUTHORIZED` | 401 | Missing/invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
