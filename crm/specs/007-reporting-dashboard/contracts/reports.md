# API Contracts: Reports

**Feature**: 007-reporting-dashboard
**Date**: 2026-06-16
**Base path**: `/api/v1/reports`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`

All timestamps: ISO 8601 UTC. All field names: camelCase.

**Access control summary**:
- `CUSTOMER` — denied on all endpoints (HTTP 403)
- `AGENT` — permitted only on `GET /reports/performance/me`
- `MANAGER`, `ADMIN` — permitted on all GET report endpoints
- `ADMIN` only — permitted on `PATCH /reports/thresholds`

---

## GET /api/v1/reports/overview

Returns the live operations overview: status counts, priority breakdown,
category breakdown, and the at-risk tickets list.

**Permitted roles**: Admin, Support Manager

**Caching**: Response is served from a 60-second in-memory cache. The `meta`
object includes `cachedAt` (ISO 8601) indicating when the cached snapshot was
computed.

### Query Parameters

None.

### Response — 200 OK

```json
{
  "data": {
    "statusCounts": {
      "OPEN": 14,
      "IN_PROGRESS": 8,
      "PENDING": 3,
      "RESOLVED_THIS_WEEK": 22,
      "CLOSED_THIS_WEEK": 17
    },
    "priorityCounts": {
      "CRITICAL": 2,
      "HIGH": 5,
      "MEDIUM": 9,
      "LOW": 6
    },
    "categoryCounts": [
      { "categoryId": "uuid", "categoryName": "Technical Support", "count": 12 },
      { "categoryId": "uuid", "categoryName": "Billing",           "count": 5 },
      { "categoryId": null,   "categoryName": "Uncategorised",     "count": 3 }
    ],
    "atRiskTickets": [
      {
        "ticketId": "uuid",
        "referenceNumber": "TKT-00042",
        "customerId": "uuid",
        "customerName": "Jane Smith",
        "categoryName": "Technical Support",
        "priority": "HIGH",
        "hoursSinceCreation": 27.4,
        "createdAt": "2026-06-15T06:30:00Z"
      }
    ]
  },
  "meta": {
    "cachedAt": "2026-06-16T09:58:00Z"
  },
  "error": null
}
```

**403 Forbidden** — Customer or unauthenticated caller.

---

## GET /api/v1/reports/volume

Returns a ticket volume report for the selected date range, including a
time-series trend and summary totals.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date; must be before `endDate` |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days after `startDate` |
| `filter[categoryId]` | UUID | No | Filter to one category |
| `filter[priority]` | string | No | `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` |
| `filter[organizationId]` | UUID | No | Filter to tickets from customers in one organisation |

**Bucketing rule**: ranges ≤ 90 days produce weekly buckets; ranges > 90 days
produce monthly buckets. The `granularity` field in the response indicates which
was applied.

### Response — 200 OK

```json
{
  "data": {
    "summary": {
      "totalCreated": 184,
      "totalResolved": 161,
      "totalClosed": 143,
      "netOpenChange": 23
    },
    "granularity": "WEEKLY",
    "trend": [
      { "bucket": "2026-05-18T00:00:00Z", "createdCount": 42, "resolvedCount": 38 },
      { "bucket": "2026-05-25T00:00:00Z", "createdCount": 39, "resolvedCount": 35 },
      { "bucket": "2026-06-01T00:00:00Z", "createdCount": 51, "resolvedCount": 47 },
      { "bucket": "2026-06-08T00:00:00Z", "createdCount": 37, "resolvedCount": 27 },
      { "bucket": "2026-06-15T00:00:00Z", "createdCount": 15, "resolvedCount": 14 }
    ]
  },
  "meta": {
    "startDate": "2026-05-17",
    "endDate": "2026-06-16",
    "filters": {
      "categoryId": null,
      "priority": null,
      "organizationId": null
    }
  },
  "error": null
}
```

**Notes**:
- Buckets with zero tickets are included in `trend` (gap-filled by the server).
- `granularity` is `"WEEKLY"` or `"MONTHLY"`.
- `netOpenChange` = `totalCreated` − `totalResolved` − `totalClosed`.

**422** — Date range exceeds 365 days or `startDate` is after `endDate`.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Date range must not exceed 365 days.",
    "details": [{ "field": "endDate", "message": "Must be within 365 days of startDate." }]
  }
}
```

---

## GET /api/v1/reports/performance

Returns the full agent performance report for the selected date range.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days from `startDate` |
| `sort` | string | No | `name` (default), `-ticketsHandled`, `-avgResolutionHours` |

### Response — 200 OK

```json
{
  "data": [
    {
      "agentId": "uuid",
      "agentName": "Bob Agent",
      "isDeactivated": false,
      "ticketsHandled": 42,
      "ticketsResolved": 38,
      "avgFirstResponseHours": 1.4,
      "avgResolutionHours": 6.2,
      "exceedsThreshold": true,
      "exceededPriority": "HIGH"
    },
    {
      "agentId": "uuid",
      "agentName": "Carol Support",
      "isDeactivated": false,
      "ticketsHandled": 27,
      "ticketsResolved": 25,
      "avgFirstResponseHours": 0.8,
      "avgResolutionHours": 4.1,
      "exceedsThreshold": false,
      "exceededPriority": null
    }
  ],
  "meta": {
    "startDate": "2026-05-17",
    "endDate": "2026-06-16",
    "sort": "name",
    "thresholdsApplied": {
      "criticalResolutionHours": 2,
      "highResolutionHours": 8,
      "mediumResolutionHours": 24,
      "lowResolutionHours": 48
    }
  },
  "error": null
}
```

**Notes**:
- `exceedsThreshold: true` when the agent's `avgResolutionHours` for any
  priority within the period exceeds the configured threshold for that priority.
- `exceededPriority` names the worst-offending priority (e.g., `"HIGH"`).
- `avgFirstResponseHours` and `avgResolutionHours` are `null` when the agent
  has zero resolved tickets in the period.
- Deactivated agents who handled tickets in the period appear with
  `isDeactivated: true`.
- `sort` values: `name` (A–Z), `-ticketsHandled` (descending),
  `-avgResolutionHours` (slowest first).

**403** — Agent attempting to access team report.
**422** — Invalid date range or sort value.

---

## GET /api/v1/reports/performance/me

Returns the requesting agent's personal performance summary for the current
week and the immediately preceding week.

**Permitted roles**: Admin, Support Manager, Support Agent
(any authenticated non-Customer user may call this endpoint; data is always
scoped to the requesting user's own tickets)

### Query Parameters

None. Date range is computed server-side: current ISO week and the previous
ISO week.

### Response — 200 OK

```json
{
  "data": {
    "currentWeek": {
      "weekStartDate": "2026-06-15",
      "ticketsHandled": 7,
      "ticketsResolved": 5,
      "avgFirstResponseHours": 1.1,
      "avgResolutionHours": 5.3
    },
    "previousWeek": {
      "weekStartDate": "2026-06-08",
      "ticketsHandled": 11,
      "ticketsResolved": 10,
      "avgFirstResponseHours": 0.9,
      "avgResolutionHours": 4.7
    }
  },
  "meta": null,
  "error": null
}
```

**Notes**:
- When `ticketsResolved` = 0, both `avgFirstResponseHours` and
  `avgResolutionHours` are `null` (not an error state).

---

## GET /api/v1/reports/resolution

Returns average first response time and resolution time segmented by
priority and category for a date range.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days from `startDate` |

### Response — 200 OK

```json
{
  "data": [
    {
      "priority": "CRITICAL",
      "categoryName": "Technical Support",
      "avgFirstResponseHours": 0.5,
      "avgResolutionHours": 1.8,
      "ticketCount": 4,
      "exceedsThreshold": true,
      "thresholdHours": 2
    },
    {
      "priority": "HIGH",
      "categoryName": "Billing",
      "avgFirstResponseHours": 2.1,
      "avgResolutionHours": 7.9,
      "ticketCount": 9,
      "exceedsThreshold": false,
      "thresholdHours": 8
    },
    {
      "priority": "MEDIUM",
      "categoryName": null,
      "avgFirstResponseHours": 3.4,
      "avgResolutionHours": 18.2,
      "ticketCount": 12,
      "exceedsThreshold": false,
      "thresholdHours": 24
    }
  ],
  "meta": {
    "startDate": "2026-05-17",
    "endDate": "2026-06-16",
    "thresholdsApplied": {
      "criticalResolutionHours": 2,
      "highResolutionHours": 8,
      "mediumResolutionHours": 24,
      "lowResolutionHours": 48
    }
  },
  "error": null
}
```

**Notes**:
- `categoryName: null` represents tickets with no assigned category.
- `exceedsThreshold: true` when `avgResolutionHours` > `thresholdHours`.
- Rows are grouped by `(priority, categoryName)` pair.
- Only priorities/categories with at least one resolved ticket in the period
  appear.

---

## GET /api/v1/reports/escalations

Returns the escalation report for the selected date range.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |
| `type` | string | No | `ALL` (default), `AUTO`, `MANUAL` |

### Response — 200 OK

```json
{
  "data": {
    "totalEscalations": 17,
    "autoEscalations": 11,
    "manualEscalations": 6,
    "avgDurationHours": 4.3,
    "escalationRatePct": 9.2,
    "byPolicy": [
      { "policyId": "uuid", "policyName": "SLA Breach Auto-Escalate", "count": 11 }
    ],
    "byAgent": [
      { "agentId": "uuid", "agentName": "Bob Agent", "count": 4 },
      { "agentId": "uuid", "agentName": "Carol Support", "count": 2 }
    ]
  },
  "meta": {
    "startDate": "2026-03-18",
    "endDate": "2026-06-16",
    "filter": { "type": "ALL" }
  },
  "error": null
}
```

**Notes**:
- When `type=MANUAL`, `byPolicy` is always an empty array.
- When `type=AUTO`, `byAgent` is always an empty array.
- `escalationRatePct` = (escalations in period / tickets created in period) x 100,
  rounded to one decimal place. Returns `0.0` when no tickets exist.
- `avgDurationHours` is `null` when no escalations have been de-escalated yet.
- All numeric fields return `0` (not `null`) when no matching escalations exist.

**422** — Invalid `type` value or date range.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid escalation type filter.",
    "details": [{ "field": "type", "message": "Must be one of: ALL, AUTO, MANUAL." }]
  }
}
```

---

## GET /api/v1/reports/customers

Returns the top N organisations by open ticket count for the selected date range.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |
| `topN` | integer | No | 5-50; default 10 |

### Response — 200 OK

```json
{
  "data": [
    {
      "rank": 1,
      "organizationId": "uuid",
      "organizationName": "Acme Corp",
      "openTicketCount": 14,
      "totalTicketCount": 38
    },
    {
      "rank": 2,
      "organizationId": "uuid",
      "organizationName": "Globex Ltd",
      "openTicketCount": 9,
      "totalTicketCount": 22
    }
  ],
  "meta": {
    "startDate": "2026-05-17",
    "endDate": "2026-06-16",
    "topN": 10,
    "totalOrganisationsWithTickets": 24
  },
  "error": null
}
```

**Notes**:
- Ranked by `openTicketCount` descending (ties broken by `totalTicketCount`
  descending, then `organizationName` ascending).
- `openTicketCount` counts tickets with `status IN (OPEN, IN_PROGRESS, PENDING)`.
- `totalTicketCount` counts all tickets created in the selected date range.

**422** — `topN` out of range or invalid date range.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "topN must be between 5 and 50.",
    "details": [{ "field": "topN", "message": "Value 3 is below the minimum of 5." }]
  }
}
```

---

## GET /api/v1/reports/thresholds

Returns the current resolution time threshold configuration.

**Permitted roles**: Admin, Support Manager, Support Agent

### Response — 200 OK

```json
{
  "data": {
    "criticalResolutionHours": 2,
    "highResolutionHours": 8,
    "mediumResolutionHours": 24,
    "lowResolutionHours": 48,
    "updatedAt": "2026-06-16T09:00:00Z",
    "updatedByName": "Alice Admin"
  },
  "meta": null,
  "error": null
}
```

**Notes**:
- `updatedAt` and `updatedByName` are `null` when thresholds have never been
  explicitly written (defaults are in effect).

---

## PATCH /api/v1/reports/thresholds

Updates one or more resolution time thresholds. Changes take effect immediately
for all subsequent report generations.

**Permitted roles**: Admin only

### Request

All fields optional; only supplied fields are updated.

```json
{
  "criticalResolutionHours": 1,
  "highResolutionHours": 6,
  "mediumResolutionHours": 20,
  "lowResolutionHours": 40
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `criticalResolutionHours` | integer | No | Positive integer; must be <= `highResolutionHours` |
| `highResolutionHours` | integer | No | Positive integer; must be <= `mediumResolutionHours` |
| `mediumResolutionHours` | integer | No | Positive integer; must be <= `lowResolutionHours` |
| `lowResolutionHours` | integer | No | Positive integer |

### Responses

**200 OK**

```json
{
  "data": {
    "criticalResolutionHours": 1,
    "highResolutionHours": 6,
    "mediumResolutionHours": 20,
    "lowResolutionHours": 40,
    "updatedAt": "2026-06-16T10:00:00Z",
    "updatedByName": "Alice Admin"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Caller is not Admin.

**422 Unprocessable Entity** — Threshold ordering violated.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Threshold ordering violated.",
    "details": [
      {
        "field": "criticalResolutionHours",
        "message": "criticalResolutionHours (10) must be <= highResolutionHours (8)."
      }
    ]
  }
}
```

---

## Common Error Codes (Reports)

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Role not permitted for this report or action |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `VALIDATION_ERROR` | 422 | Query parameter or body schema failure |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
