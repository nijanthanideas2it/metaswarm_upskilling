# API Contracts: Notifications — Inbox & SSE Stream

**Feature**: 006-notifications
**Date**: 2026-06-16
**Base paths**: `/api/v1/notifications`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

---

## GET /api/v1/notifications/inbox

Returns the authenticated user's notification inbox, paginated newest-first.
Customers see only notifications for their own tickets. Agents, Managers, and
Admins see notifications addressed to them. Notifications older than 90 days
are excluded.

**Permitted roles**: All authenticated users (scoped to own inbox)

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 20 | Min 1, max 50 |
| `filter[isRead]` | boolean | — | `true` or `false` to filter by read status |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "TICKET_ASSIGNED",
      "summary": "Ticket TKT-00042 has been assigned to you.",
      "ticketReference": "TKT-00042",
      "ticketId": "uuid-of-ticket",
      "portalLink": "/tickets/uuid-of-ticket",
      "isRead": false,
      "channel": "IN_APP",
      "createdAt": "2026-06-16T10:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "TICKET_STATUS_CHANGED",
      "summary": "Ticket TKT-00038 status changed from OPEN to IN_PROGRESS.",
      "ticketReference": "TKT-00038",
      "ticketId": "uuid-of-ticket",
      "portalLink": "/tickets/uuid-of-ticket",
      "isRead": true,
      "channel": "IN_APP",
      "createdAt": "2026-06-16T09:30:00Z"
    }
  ],
  "meta": {
    "total": 47,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true,
    "unreadCount": 12
  },
  "error": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | `Notification.id` |
| `eventType` | string | One of the 10 `NotificationEventType` values |
| `summary` | string | Rendered in-app summary text from template |
| `ticketReference` | string | e.g. `"TKT-00042"`; always present for ticket events |
| `ticketId` | UUID | Source ticket ID for direct navigation |
| `portalLink` | string | Relative URL to the related record |
| `isRead` | boolean | Whether the user has read this notification |
| `channel` | string | Always `"IN_APP"` for inbox endpoint |
| `createdAt` | ISO 8601 | Notification creation time |

`meta.unreadCount` — total count of unread IN_APP notifications for this user
(not limited to the current page). Capped at `99` for display; actual value
returned in the API (`meta.unreadCount` may exceed 99).

**401** — Missing/invalid token | **422** — Invalid query parameters

---

## PATCH /api/v1/notifications/:id/read

Marks a single notification as read. No-op if already read.

**Permitted roles**: All authenticated users (own notifications only)

### Request — empty body

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "isRead": true,
    "updatedAt": "2026-06-16T10:05:00Z"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Notification does not belong to the caller:
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this notification.",
    "details": null
  }
}
```

**404 Not Found** — Notification ID not found.

---

## POST /api/v1/notifications/mark-all-read

Marks all IN_APP notifications for the authenticated user as read. Bulk
operation — always succeeds even if there are zero unread notifications.

**Permitted roles**: All authenticated users (own inbox only)

### Request — empty body

### Response — 200 OK

```json
{
  "data": {
    "markedReadCount": 12
  },
  "meta": null,
  "error": null
}
```

`markedReadCount` — number of notifications that transitioned from unread to
read in this operation. `0` if all were already read.

**401** — Missing/invalid token

---

## GET /api/v1/notifications/stream

Establishes a Server-Sent Events (SSE) connection for real-time in-app
notification delivery. The server pushes a `data:` event each time a new
`IN_APP` notification is created for the authenticated user. The connection
is long-lived; clients should reconnect automatically on disconnect.

**Permitted roles**: All authenticated users

### Request Headers

```
Authorization: Bearer <accessToken>
Accept: text/event-stream
Cache-Control: no-cache
```

### Response — 200 OK (streaming)

```
Content-Type: text/event-stream
X-Accel-Buffering: no
Cache-Control: no-cache
Connection: keep-alive
```

**Heartbeat**: The server emits a comment line every 30 seconds to keep the
connection alive through proxies:
```
: heartbeat
```

**Notification event format** (emitted on each new in-app notification):
```
data: {"id":"uuid","eventType":"TICKET_ASSIGNED","summary":"Ticket TKT-00042 has been assigned to you.","ticketReference":"TKT-00042","ticketId":"uuid","portalLink":"/tickets/uuid","isRead":false,"createdAt":"2026-06-16T10:00:00Z"}

```

> The double newline (`\n\n`) after `data:` terminates the event per SSE spec.
> Each message is a single `data:` line containing a JSON-serialised notification
> object with the same shape as the inbox list item.

**Reconnect behaviour**: On client reconnect, the client should supply the
`Last-Event-ID` header with the ID of the last received notification. The server
replays any notifications created after that ID within the last 30 seconds:

```
GET /api/v1/notifications/stream
Last-Event-ID: uuid-of-last-received-notification
```

The server will emit all missed `IN_APP` notifications newer than `Last-Event-ID`
before resuming the live stream. Missed notifications older than 30 seconds are
NOT replayed — clients must poll the inbox endpoint to catch up.

**Connection lifecycle**:
- Client disconnects → server removes the `Response` object from the emitter
  map; no error logged.
- Server restarts → clients reconnect automatically; server replays notifications
  from `Last-Event-ID` (last 30 seconds window).
- Maximum 1 SSE connection per user at a time; a second connection from the same
  user replaces the first (old connection is closed with a `data:` message:
  `{"type":"CONNECTION_REPLACED"}`).

**Mobile client fallback**: React Native clients that do not support SSE MUST
poll `GET /api/v1/notifications/inbox` at a minimum 30-second interval to
satisfy the spec's 30-second delivery requirement (SC-001).

**401 Unauthorized** — Missing/invalid token (returns standard JSON error body,
not an SSE stream, with `Content-Type: application/json`):
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired token.", "details": null }
}
```

---

## Common Error Codes (Notifications)

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Notification belongs to a different user |
| `NOT_FOUND` | 404 | Notification ID not found or older than 90 days |
| `VALIDATION_ERROR` | 422 | Query parameter schema failure |
| `UNAUTHORIZED` | 401 | Missing/invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
