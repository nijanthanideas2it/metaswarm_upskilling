# API Contract: Teams

**Feature**: 004-ticket-assignment
**Date**: 2026-06-16
**Base path**: `/api/v1/teams`
**Auth**: All endpoints require a valid JWT Bearer token.

---

## POST /api/v1/teams

**Description**: Create a new support team.
**Auth**: Admin

**Request body**:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | max 100 chars; must be unique across all teams |
| `description` | string | no | max 500 chars |

**Response** `201 Created`:

```json
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support",
    "description": "Handles all technical issues",
    "isActive": true,
    "memberCount": 0,
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — validation failure (name missing, name >100 chars, description >500 chars)
- `401 Unauthorized` — missing or invalid token
- `403 Forbidden` — caller is not Admin
- `409 Conflict` — a team with this name already exists

**Example**:

```json
// Request body
{
  "name": "Technical Support",
  "description": "Handles all technical issues"
}

// Response 201
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support",
    "description": "Handles all technical issues",
    "isActive": true,
    "memberCount": 0,
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}

// Error 409
{
  "data": null,
  "meta": null,
  "error": {
    "code": "TEAM_NAME_CONFLICT",
    "message": "A team named 'Technical Support' already exists.",
    "details": null
  }
}
```

---

## GET /api/v1/teams

**Description**: List all support teams with optional filtering by active status.
**Auth**: Admin, Manager

**Query parameters**:

| Parameter | Type | Required | Default | Constraints |
|-----------|------|----------|---------|-------------|
| `isActive` | boolean | no | (all teams returned) | `true` or `false` |
| `page` | integer | no | `1` | ≥1 |
| `pageSize` | integer | no | `20` | 1–100 |

**Response** `200 OK`:

```json
{
  "data": [
    {
      "id": "e3a1c2d4-5678-4abc-9def-000000000001",
      "name": "Technical Support",
      "description": "Handles all technical issues",
      "isActive": true,
      "memberCount": 3,
      "createdAt": "2026-06-16T10:00:00Z",
      "updatedAt": "2026-06-16T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  },
  "error": null
}
```

**Errors**:
- `400 Bad Request` — invalid query parameter values
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin or Manager

**Example**:

```
GET /api/v1/teams?isActive=true&page=1&pageSize=20
```

```json
// Response 200
{
  "data": [
    {
      "id": "e3a1c2d4-5678-4abc-9def-000000000001",
      "name": "Technical Support",
      "description": "Handles all technical issues",
      "isActive": true,
      "memberCount": 3,
      "createdAt": "2026-06-16T10:00:00Z",
      "updatedAt": "2026-06-16T10:00:00Z"
    },
    {
      "id": "f4b2d3e5-6789-5bcd-aef0-000000000002",
      "name": "Billing",
      "description": "Handles billing and payment queries",
      "isActive": true,
      "memberCount": 2,
      "createdAt": "2026-06-16T10:05:00Z",
      "updatedAt": "2026-06-16T10:05:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 2,
    "totalPages": 1
  },
  "error": null
}
```

---

## GET /api/v1/teams/:id

**Description**: Retrieve a single team with its full member list. Each member
entry includes their current availability status and open ticket count.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Team ID |

**Response** `200 OK`:

```json
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support",
    "description": "Handles all technical issues",
    "isActive": true,
    "memberCount": 2,
    "members": [
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
        "name": "Alice Nguyen",
        "email": "alice@co.com",
        "availabilityStatus": "AVAILABLE",
        "openTicketCount": 3,
        "joinedAt": "2026-06-16T10:00:00Z"
      },
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000002",
        "name": "Bob Kim",
        "email": "bob@co.com",
        "availabilityStatus": "BUSY",
        "openTicketCount": 5,
        "joinedAt": "2026-06-16T10:02:00Z"
      }
    ],
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found` — no team with this ID exists

**Notes**: `openTicketCount` reflects tickets where `status IN ('OPEN', 'IN_PROGRESS')`.
`availabilityStatus` is the effective engine status — it is `OFFLINE` if the agent
is outside their scheduled window, regardless of their manually set status.

---

## PATCH /api/v1/teams/:id

**Description**: Update a team's name and/or description. Cannot change `isActive`
via this endpoint (use the deactivate endpoint).
**Auth**: Admin

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Team ID |

**Request body** (all fields optional; at least one required):

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | no | max 100 chars; must be unique |
| `description` | string | no | max 500 chars; send `null` to clear |

**Response** `200 OK`:

```json
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support (Tier 1)",
    "description": "Handles Tier 1 technical issues",
    "isActive": true,
    "memberCount": 2,
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — validation failure
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin
- `404 Not Found`
- `409 Conflict` — new name conflicts with an existing team

**Example**:

```json
// PATCH /api/v1/teams/e3a1c2d4-5678-4abc-9def-000000000001
// Request body
{
  "name": "Technical Support (Tier 1)"
}

// Response 200
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support (Tier 1)",
    "description": "Handles all technical issues",
    "isActive": true,
    "memberCount": 2,
    "createdAt": "2026-06-16T10:00:00Z",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

---

## POST /api/v1/teams/:id/deactivate

**Description**: Deactivate a support team. All active assignment rules that
target this team are automatically deactivated in the same transaction. Returns
the list of affected rules in the response body so the caller can inform the
manager.
**Auth**: Admin

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Team ID |

**Request body**: None.

**Response** `200 OK`:

```json
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support",
    "isActive": false,
    "affectedRules": [
      {
        "id": "r1a2b3c4-0000-0000-0000-000000000001",
        "name": "Technical High Priority to Tech Support Team"
      }
    ],
    "updatedAt": "2026-06-16T12:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin
- `404 Not Found`
- `409 Conflict` — team is already inactive

**Notes**: Existing `Ticket.teamId` values that reference this team are not
cleared retroactively — only future routing is blocked. `affectedRules` is an
empty array (`[]`) if no active rules targeted this team.

**Example**:

```json
// POST /api/v1/teams/e3a1c2d4-5678-4abc-9def-000000000001/deactivate
// Response 200
{
  "data": {
    "id": "e3a1c2d4-5678-4abc-9def-000000000001",
    "name": "Technical Support",
    "isActive": false,
    "affectedRules": [
      {
        "id": "r1a2b3c4-0000-0000-0000-000000000001",
        "name": "Technical High Priority to Tech Support Team"
      },
      {
        "id": "r1a2b3c4-0000-0000-0000-000000000002",
        "name": "All Technical Tickets Fallback"
      }
    ],
    "updatedAt": "2026-06-16T12:00:00Z"
  },
  "meta": null,
  "error": null
}
```

---

## POST /api/v1/teams/:teamId/members

**Description**: Add an active Support Agent as a member of the team. If the agent
is already a member, returns 409.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `teamId` | UUID string | yes | Team ID |

**Request body**:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `agentId` | UUID string | yes | Must be an existing active user with role SUPPORT_AGENT |

**Response** `201 Created`:

```json
{
  "data": {
    "teamId": "e3a1c2d4-5678-4abc-9def-000000000001",
    "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
    "agentName": "Alice Nguyen",
    "joinedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — `agentId` missing or not a valid UUID
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin or Manager
- `404 Not Found` — team not found, or agent user not found
- `409 Conflict` — agent is already a member of this team; or team is inactive
- `422 Unprocessable Entity` — target user is not a Support Agent or is deactivated

**Example**:

```json
// POST /api/v1/teams/e3a1c2d4-5678-4abc-9def-000000000001/members
// Request body
{
  "agentId": "a1b2c3d4-0000-0000-0000-000000000001"
}

// Response 201
{
  "data": {
    "teamId": "e3a1c2d4-5678-4abc-9def-000000000001",
    "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
    "agentName": "Alice Nguyen",
    "joinedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}

// Error 409 — already a member
{
  "data": null,
  "meta": null,
  "error": {
    "code": "ALREADY_TEAM_MEMBER",
    "message": "Agent is already a member of this team.",
    "details": null
  }
}
```

---

## DELETE /api/v1/teams/:teamId/members/:agentId

**Description**: Remove a Support Agent from a team. Existing ticket assignments
are not affected.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `teamId` | UUID string | yes | Team ID |
| `agentId` | UUID string | yes | Agent's user ID |

**Response** `204 No Content`

**Errors**:
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin or Manager
- `404 Not Found` — team not found, or agent is not a member of the team

**Notes**: This operation does not reassign tickets currently held by the removed
agent that were routed via this team. The agent's existing assignments remain
unchanged. They simply become ineligible for future routing via this team.

**Example**:

```
DELETE /api/v1/teams/e3a1c2d4-5678-4abc-9def-000000000001/members/a1b2c3d4-0000-0000-0000-000000000001

// Response 204 (no body)
```
