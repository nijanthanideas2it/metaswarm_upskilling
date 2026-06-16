# API Contracts: Tickets

**Feature**: 003-ticket-management
**Date**: 2026-06-16
**Base path**: `/api/v1/tickets`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

---

## POST /api/v1/tickets

Creates a new support ticket.

**Permitted roles**: Customer, Admin, Support Manager, Support Agent
(Agents/Managers/Admins must supply `customerId`; Customers use their own identity.)

### Request

```json
{
  "title": "Cannot log into portal",
  "description": "Getting a 401 error since this morning on every login attempt.",
  "priority": "HIGH",
  "categoryId": "uuid-of-category",
  "customerId": "uuid-of-customer"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `title` | string | Yes | 1–200 chars |
| `description` | string | Yes | 1–5,000 chars |
| `priority` | string | No | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`; default `MEDIUM` |
| `categoryId` | UUID | No | Must reference active category |
| `customerId` | UUID | Agents/Admins only | Own ID used for Customer role |

### Responses

**201 Created**

```json
{
  "data": {
    "id": "uuid",
    "referenceNumber": "TKT-00001",
    "title": "Cannot log into portal",
    "description": "Getting a 401 error since this morning...",
    "status": "OPEN",
    "priority": "HIGH",
    "categoryId": "uuid",
    "categoryName": "Technical Support",
    "customerId": "uuid",
    "customerName": "Jane Smith",
    "assignedAgentId": null,
    "isEscalated": false,
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**422** — Validation failure | **403** — Role not permitted | **401** — Unauthenticated

---

## GET /api/v1/tickets

Paginated list of tickets visible to the caller.

**Scope by role**:
- Customer → own tickets only
- Agent → unassigned + assigned to themselves
- Manager / Admin → all tickets

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 20 | Max 100 |
| `filter[status]` | string | — | One of the 6 status values |
| `filter[priority]` | string | — | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `filter[categoryId]` | UUID | — | Filter by category |
| `filter[assignedAgentId]` | UUID | — | Manager/Admin only |
| `sort` | string | `-createdAt` | `createdAt`, `-createdAt`, `priority`, `-priority`, `updatedAt` |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "referenceNumber": "TKT-00001",
      "title": "Cannot log into portal",
      "status": "OPEN",
      "priority": "HIGH",
      "categoryName": "Technical Support",
      "customerName": "Jane Smith",
      "assignedAgentName": null,
      "isEscalated": false,
      "createdAt": "2026-06-16T10:00:00Z",
      "updatedAt": "2026-06-16T10:00:00Z"
    }
  ],
  "meta": { "total": 84, "page": 1, "pageSize": 20, "hasNextPage": true },
  "error": null
}
```

---

## GET /api/v1/tickets/:id

Full ticket detail including activity log summary.

**Permitted roles**: Owner customer, assigned agent, Manager, Admin.

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "referenceNumber": "TKT-00001",
    "title": "Cannot log into portal",
    "description": "Getting a 401 error since this morning...",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "categoryId": "uuid",
    "categoryName": "Technical Support",
    "customerId": "uuid",
    "customerName": "Jane Smith",
    "assignedAgentId": "uuid",
    "assignedAgentName": "Bob Agent",
    "isEscalated": false,
    "resolvedAt": null,
    "closedAt": null,
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T11:00:00Z",
    "activityLog": [
      {
        "id": "uuid",
        "event": "CREATED",
        "actorName": "Jane Smith",
        "previousValue": null,
        "newValue": null,
        "createdAt": "2026-06-16T10:00:00Z"
      }
    ]
  },
  "meta": null,
  "error": null
}
```

**403** — Customer accessing another customer's ticket | **404** — Not found

---

## PATCH /api/v1/tickets/:id

Updates ticket fields. All fields optional (partial update).

**Permitted roles**: Agent (own tickets, limited fields), Manager, Admin.

### Request

```json
{
  "priority": "CRITICAL",
  "categoryId": "uuid-of-new-category",
  "title": "Updated title"
}
```

### Response — 200 OK — returns updated ticket (same shape as GET /:id `data`)

---

## POST /api/v1/tickets/:id/assign

Assigns or reassigns a ticket to a specific agent.

**Permitted roles**: Admin, Support Manager

### Request

```json
{ "agentId": "uuid-of-agent" }
```

### Responses

**200 OK** — `{ "data": { "id": "uuid", "assignedAgentId": "uuid", "assignedAgentName": "Bob Agent" }, "meta": null, "error": null }`

**400** — Invalid transition | **403** — Forbidden | **404** — Ticket not found

**422** — Agent is deactivated:
```json
{ "data": null, "meta": null, "error": { "code": "AGENT_DEACTIVATED", "message": "Cannot assign to a deactivated agent.", "details": null } }
```

---

## POST /api/v1/tickets/:id/self-assign

Agent claims an unassigned ticket for themselves.

**Permitted roles**: Support Agent

### Request — empty body

### Responses

**200 OK** — Same shape as `/assign` 200.

**409 Conflict** — Ticket was just taken:
```json
{ "data": null, "meta": null, "error": { "code": "ALREADY_ASSIGNED", "message": "This ticket was just assigned to another agent.", "details": null } }
```

---

## POST /api/v1/tickets/:id/cancel

Customer cancels their own OPEN ticket.

**Permitted roles**: Customer (own ticket only)

### Request — empty body

### Responses

**200 OK** — `{ "data": { "id": "uuid", "status": "CANCELLED", "closedAt": "..." }, ... }`

**409 Conflict** — Ticket is not OPEN:
```json
{ "data": null, "meta": null, "error": { "code": "INVALID_TRANSITION", "message": "Only OPEN tickets can be cancelled by the customer.", "details": null } }
```

---

## POST /api/v1/tickets/:id/resolve

Agent marks a ticket as resolved.

**Permitted roles**: Assigned Support Agent, Manager, Admin

### Request — empty body

### Response — 200 OK — `{ "data": { "id": "uuid", "status": "RESOLVED", "resolvedAt": "..." }, ... }`

---

## POST /api/v1/tickets/:id/close

Customer confirms resolution, closing the ticket.

**Permitted roles**: Customer (own ticket only)

### Request — empty body

### Response — 200 OK — `{ "data": { "id": "uuid", "status": "CLOSED", "closedAt": "..." }, ... }`

---

## Common Error Codes (Tickets)

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_TRANSITION` | 409 | Status change violates state machine |
| `ALREADY_ASSIGNED` | 409 | Concurrent self-assign lost |
| `AGENT_DEACTIVATED` | 422 | Assignment target is deactivated |
| `NOT_FOUND` | 404 | Ticket ID not found |
| `FORBIDDEN` | 403 | Role or ownership check failed |
| `VALIDATION_ERROR` | 422 | Request body schema failure |
| `UNAUTHORIZED` | 401 | Missing/invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
