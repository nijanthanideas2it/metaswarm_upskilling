# API Contracts: Notification Preferences

**Feature**: 006-notifications
**Date**: 2026-06-16
**Base path**: `/api/v1/notification-preferences`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

---

## GET /api/v1/notification-preferences

Returns all notification preferences for the authenticated user — one row per
`(eventType, channel)` pair (20 rows total: 10 event types × 2 channels).

**Permitted roles**: All authenticated users (own preferences only)

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "channel": "EMAIL",
      "enabled": true,
      "quietHoursStart": "23:00",
      "quietHoursEnd": "07:00",
      "quietHoursTimezone": "America/New_York",
      "updatedAt": "2026-06-16T09:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "channel": "IN_APP",
      "enabled": true,
      "quietHoursStart": null,
      "quietHoursEnd": null,
      "quietHoursTimezone": null,
      "updatedAt": "2026-06-16T00:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "TICKET_COMMENT_ADDED",
      "channel": "EMAIL",
      "enabled": false,
      "quietHoursStart": null,
      "quietHoursEnd": null,
      "quietHoursTimezone": null,
      "updatedAt": "2026-06-16T10:30:00Z"
    }
  ],
  "meta": null,
  "error": null
}
```

The array is always returned in the canonical order: sorted by `eventType` (enum
declaration order) then `channel` (`IN_APP` before `EMAIL`). All 20 rows are
always returned — no pagination.

**401** — Missing/invalid token

---

## PUT /api/v1/notification-preferences

Updates one or more notification preferences for the authenticated user. Only
the supplied `(eventType, channel)` pairs are updated; omitted pairs are unchanged.
Preference changes take effect for all events processed more than 60 seconds after
the update (FR-022).

**Permitted roles**: All authenticated users (own preferences only)

### Request

```json
{
  "preferences": [
    {
      "eventType": "TICKET_COMMENT_ADDED",
      "channel": "EMAIL",
      "enabled": false
    },
    {
      "eventType": "TICKET_ASSIGNED",
      "channel": "EMAIL",
      "enabled": true,
      "quietHoursStart": "22:00",
      "quietHoursEnd": "07:00",
      "quietHoursTimezone": "Europe/London"
    }
  ]
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `preferences` | array | Yes | 1–20 items |
| `preferences[].eventType` | string | Yes | One of the 10 `NotificationEventType` values |
| `preferences[].channel` | string | Yes | `IN_APP` or `EMAIL` |
| `preferences[].enabled` | boolean | Yes | |
| `preferences[].quietHoursStart` | string | No | `HH:MM` 24h; required if `quietHoursEnd` or `quietHoursTimezone` supplied |
| `preferences[].quietHoursEnd` | string | No | `HH:MM` 24h; required if `quietHoursStart` or `quietHoursTimezone` supplied |
| `preferences[].quietHoursTimezone` | string | No | Valid IANA timezone (e.g. `"America/New_York"`); required if `quietHoursStart` or `quietHoursEnd` supplied |

**Quiet hours rules**:
- All three quiet hours fields (`quietHoursStart`, `quietHoursEnd`, `quietHoursTimezone`)
  must be provided together, or all three must be omitted.
- Quiet hours are only meaningful for `channel = EMAIL`; supplying them for
  `channel = IN_APP` is accepted but has no operational effect.
- To clear quiet hours, send all three as `null`.

### Response — 200 OK

Returns the full updated preference rows for every `(eventType, channel)` pair
specified in the request. Shape of each item is identical to the GET response
array items.

```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "TICKET_COMMENT_ADDED",
      "channel": "EMAIL",
      "enabled": false,
      "quietHoursStart": null,
      "quietHoursEnd": null,
      "quietHoursTimezone": null,
      "updatedAt": "2026-06-16T11:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "channel": "EMAIL",
      "enabled": true,
      "quietHoursStart": "22:00",
      "quietHoursEnd": "07:00",
      "quietHoursTimezone": "Europe/London",
      "updatedAt": "2026-06-16T11:00:00Z"
    }
  ],
  "meta": null,
  "error": null
}
```

**422 Validation Error** — Partial quiet hours fields, unknown event type, or
invalid timezone:
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Quiet hours fields must all be provided together or all omitted.",
    "details": [
      { "field": "preferences[1].quietHoursEnd", "issue": "Required when quietHoursStart is provided." }
    ]
  }
}
```

**401** — Missing/invalid token

---

## GET /api/v1/notification-preferences/users/:userId

Returns the notification preferences for a specific user. Admin-only.

**Permitted roles**: Admin, Support Manager

### Response — 200 OK

Same shape as `GET /api/v1/notification-preferences` (20-item array for the
target user).

**403 Forbidden** — Caller is not Admin or Manager.

**404 Not Found** — User ID not found.

---

## PUT /api/v1/notification-preferences/users/:userId

Admin overrides one or more notification preferences for a specific user. The
override is persisted identically to a user self-update — it writes to the same
`NotificationPreference` rows. The override identity and reason are written to
an audit log (logged at application level, not returned in the response).

**Permitted roles**: Admin only

### Request

```json
{
  "preferences": [
    {
      "eventType": "TICKET_ESCALATED",
      "channel": "EMAIL",
      "enabled": true
    }
  ],
  "auditReason": "Compliance requirement: all escalation emails must remain enabled for agents in EU region."
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `preferences` | array | Yes | Same rules as user self-update |
| `auditReason` | string | Yes | 1–500 chars; logged with admin identity |

### Response — 200 OK

Same shape as user self-update `PUT` response. Returns only the updated rows.

```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "TICKET_ESCALATED",
      "channel": "EMAIL",
      "enabled": true,
      "quietHoursStart": null,
      "quietHoursEnd": null,
      "quietHoursTimezone": null,
      "updatedAt": "2026-06-16T12:00:00Z"
    }
  ],
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Caller is not Admin.

**404 Not Found** — User ID not found.

**422 Validation Error** — `auditReason` missing or preference validation failed.

---

## Common Error Codes (Notification Preferences)

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 422 | Schema failure (missing fields, invalid enum, bad timezone) |
| `FORBIDDEN` | 403 | Insufficient role for the operation |
| `NOT_FOUND` | 404 | Target user ID not found |
| `UNAUTHORIZED` | 401 | Missing/invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
