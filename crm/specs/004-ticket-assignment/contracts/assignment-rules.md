# API Contract: Assignment Rules & Agent Availability

**Feature**: 004-ticket-assignment
**Date**: 2026-06-16
**Base paths**: `/api/v1/assignment-rules`, `/api/v1/agent-availability`
**Auth**: All endpoints require a valid JWT Bearer token.

---

## POST /api/v1/assignment-rules

**Description**: Create a new assignment rule with one or more match conditions
and a routing target (either a team or a specific agent — not both).
**Auth**: Admin, Manager

**Request body**:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | max 100 chars; must be unique |
| `rank` | integer | yes | ≥1; non-unique (duplicate ranks allowed, flagged as conflict) |
| `conditions` | array | yes | min 1 item; see condition object below |
| `targetTeamId` | UUID string | no* | Must be an active team; mutually exclusive with `targetAgentId` |
| `targetAgentId` | UUID string | no* | Must be an active Support Agent; mutually exclusive with `targetTeamId` |

*Exactly one of `targetTeamId` or `targetAgentId` must be provided.

**Condition object**:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `field` | string | yes | `"CATEGORY"`, `"PRIORITY"`, or `"ORGANISATION"` |
| `operator` | string | yes | `"EQUALS"` or `"IN"` |
| `value` | string | yes | For `EQUALS`: single string value. For `IN`: JSON array string e.g. `"[\"HIGH\",\"CRITICAL\"]"` |

**Response** `201 Created`:

```json
{
  "data": {
    "id": "r1a2b3c4-0000-0000-0000-000000000001",
    "name": "Technical High Priority to Tech Support Team",
    "rank": 10,
    "isActive": true,
    "hasConflict": false,
    "targetTeamId": "e3a1c2d4-5678-4abc-9def-000000000001",
    "targetTeamName": "Technical Support",
    "targetAgentId": null,
    "targetAgentName": null,
    "conditions": [
      {
        "id": "c1d2e3f4-0000-0000-0000-000000000001",
        "field": "CATEGORY",
        "operator": "EQUALS",
        "value": "cat-uuid-technical-support"
      },
      {
        "id": "c1d2e3f4-0000-0000-0000-000000000002",
        "field": "PRIORITY",
        "operator": "EQUALS",
        "value": "HIGH"
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
- `400 Bad Request` — validation failure (name missing, no conditions, invalid field/operator/value, both or neither target provided)
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin or Manager
- `404 Not Found` — `targetTeamId` or `targetAgentId` does not exist
- `409 Conflict` — rule name already exists; or `targetTeamId` references an inactive team

**Example**:

```json
// Request body
{
  "name": "Technical High Priority to Tech Support Team",
  "rank": 10,
  "conditions": [
    { "field": "CATEGORY", "operator": "EQUALS", "value": "cat-uuid-technical-support" },
    { "field": "PRIORITY", "operator": "EQUALS", "value": "HIGH" }
  ],
  "targetTeamId": "e3a1c2d4-5678-4abc-9def-000000000001"
}
```

---

## GET /api/v1/assignment-rules

**Description**: List all assignment rules ordered by rank ascending. Each rule
includes a `hasConflict` flag indicating whether another active rule shares the
same rank. Inactive rules are included in the list; filter on client if needed.
**Auth**: Admin, Manager

**Query parameters**: None (all rules returned; no pagination — max 50 rules).

**Response** `200 OK`:

```json
{
  "data": [
    {
      "id": "r1a2b3c4-0000-0000-0000-000000000001",
      "name": "Technical High Priority to Tech Support Team",
      "rank": 10,
      "isActive": true,
      "hasConflict": true,
      "targetTeamId": "e3a1c2d4-5678-4abc-9def-000000000001",
      "targetTeamName": "Technical Support",
      "targetAgentId": null,
      "targetAgentName": null,
      "conditionCount": 2,
      "createdAt": "2026-06-16T10:00:00Z",
      "updatedAt": "2026-06-16T10:00:00Z"
    },
    {
      "id": "r1a2b3c4-0000-0000-0000-000000000002",
      "name": "Technical High Priority Direct to Agent1",
      "rank": 10,
      "isActive": true,
      "hasConflict": true,
      "targetTeamId": null,
      "targetTeamName": null,
      "targetAgentId": "a1b2c3d4-0000-0000-0000-000000000001",
      "targetAgentName": "Alice Nguyen",
      "conditionCount": 2,
      "createdAt": "2026-06-16T10:05:00Z",
      "updatedAt": "2026-06-16T10:05:00Z"
    }
  ],
  "meta": null,
  "error": null
}
```

**Errors**:
- `401 Unauthorized`
- `403 Forbidden`

**Notes**: The list endpoint returns `conditionCount` (not the full conditions
array) for performance. Use `GET /api/v1/assignment-rules/:id` for full condition
details. `hasConflict = true` means another active rule shares this rule's exact
rank value.

---

## GET /api/v1/assignment-rules/:id

**Description**: Retrieve a single assignment rule with its full conditions array.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Rule ID |

**Response** `200 OK`:

```json
{
  "data": {
    "id": "r1a2b3c4-0000-0000-0000-000000000001",
    "name": "Technical High Priority to Tech Support Team",
    "rank": 10,
    "isActive": true,
    "hasConflict": true,
    "targetTeamId": "e3a1c2d4-5678-4abc-9def-000000000001",
    "targetTeamName": "Technical Support",
    "targetAgentId": null,
    "targetAgentName": null,
    "conditions": [
      {
        "id": "c1d2e3f4-0000-0000-0000-000000000001",
        "field": "CATEGORY",
        "operator": "EQUALS",
        "value": "cat-uuid-technical-support"
      },
      {
        "id": "c1d2e3f4-0000-0000-0000-000000000002",
        "field": "PRIORITY",
        "operator": "EQUALS",
        "value": "HIGH"
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
- `404 Not Found`

---

## PATCH /api/v1/assignment-rules/:id

**Description**: Update a rule's name, rank, conditions, and/or routing target.
All fields are optional; at least one must be provided. Conditions are replaced
wholesale — send the full desired conditions array.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Rule ID |

**Request body** (all fields optional; at least one required):

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | no | max 100 chars; must be unique |
| `rank` | integer | no | ≥1 |
| `conditions` | array | no | min 1 item; replaces all existing conditions |
| `targetTeamId` | UUID string | no | Mutually exclusive with `targetAgentId`; send `null` to clear while setting `targetAgentId` |
| `targetAgentId` | UUID string | no | Mutually exclusive with `targetTeamId`; send `null` to clear while setting `targetTeamId` |

**Response** `200 OK`: Same shape as `GET /api/v1/assignment-rules/:id`.

**Errors**:
- `400 Bad Request` — validation failure; both targets provided; conditions array is empty
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` — new name conflicts with another rule
- `422 Unprocessable Entity` — `targetTeamId` references an inactive team

**Example**:

```json
// PATCH /api/v1/assignment-rules/r1a2b3c4-0000-0000-0000-000000000001
// Request body — change rank only
{
  "rank": 5
}
```

---

## DELETE /api/v1/assignment-rules/:id

**Description**: Permanently delete an assignment rule. The rule must be inactive
before deletion; attempting to delete an active rule returns 422.
**Auth**: Admin

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Rule ID |

**Response** `204 No Content`

**Errors**:
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin
- `404 Not Found`
- `422 Unprocessable Entity` — rule is still active; deactivate it first

**Example**:

```
DELETE /api/v1/assignment-rules/r1a2b3c4-0000-0000-0000-000000000001

// Error 422 if still active
{
  "data": null,
  "meta": null,
  "error": {
    "code": "RULE_STILL_ACTIVE",
    "message": "Deactivate the rule before deleting it.",
    "details": null
  }
}
```

---

## POST /api/v1/assignment-rules/:id/activate

**Description**: Activate an inactive assignment rule. The rule becomes eligible
to fire immediately on the next ticket creation event.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Rule ID |

**Response** `200 OK`:

```json
{
  "data": {
    "id": "r1a2b3c4-0000-0000-0000-000000000001",
    "name": "Technical High Priority to Tech Support Team",
    "rank": 10,
    "isActive": true,
    "hasConflict": false,
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` — rule is already active
- `422 Unprocessable Entity` — rule's target team or agent has been deactivated/deleted since creation

---

## POST /api/v1/assignment-rules/:id/deactivate

**Description**: Deactivate an active assignment rule. The rule is immediately
excluded from engine evaluation.
**Auth**: Admin, Manager

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID string | yes | Rule ID |

**Response** `200 OK`:

```json
{
  "data": {
    "id": "r1a2b3c4-0000-0000-0000-000000000001",
    "name": "Technical High Priority to Tech Support Team",
    "rank": 10,
    "isActive": false,
    "hasConflict": false,
    "updatedAt": "2026-06-16T11:05:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` — rule is already inactive

---

## PUT /api/v1/assignment-rules/reorder

**Description**: Bulk-update ranks for one or more assignment rules in a single
atomic operation. All provided rule IDs must exist. The new ranks take effect
for tickets created after the response is returned (within the 10-second SLA,
SC-005).
**Auth**: Admin, Manager

**Request body**: Array of rank update objects.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID string | yes | Must be an existing rule ID |
| `rank` | integer | yes | ≥1 |

**Response** `200 OK`:

```json
{
  "data": [
    {
      "id": "r1a2b3c4-0000-0000-0000-000000000001",
      "name": "Technical High Priority to Tech Support Team",
      "rank": 20,
      "isActive": true,
      "hasConflict": false
    },
    {
      "id": "r1a2b3c4-0000-0000-0000-000000000002",
      "name": "Technical High Priority Direct to Agent1",
      "rank": 5,
      "isActive": true,
      "hasConflict": false
    }
  ],
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — empty array; any item missing `id` or `rank`; `rank` < 1
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found` — one or more rule IDs do not exist (error details list the missing IDs)

**Notes**: Sending duplicate ranks in the request body is allowed (creates a new
conflict). The response `hasConflict` flag will be `true` for any rules that end
up sharing a rank. Only the rules included in the request body are updated; all
other rules are unchanged.

**Example**:

```json
// Request body
[
  { "id": "r1a2b3c4-0000-0000-0000-000000000001", "rank": 20 },
  { "id": "r1a2b3c4-0000-0000-0000-000000000002", "rank": 5  }
]
```

---

## GET /api/v1/agent-availability/:agentId

**Description**: Retrieve an agent's current availability status and their full
weekly schedule. Accessible by Admin, Manager, or the agent themselves.
**Auth**: Admin, Manager, or the agent whose ID matches the path parameter

**Path parameters**:

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `agentId` | UUID string | yes | Agent's user ID |

**Response** `200 OK`:

```json
{
  "data": {
    "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
    "agentName": "Alice Nguyen",
    "status": "AVAILABLE",
    "effectiveStatus": "AVAILABLE",
    "updatedAt": "2026-06-16T09:00:00Z",
    "schedule": [
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000001",
        "dayOfWeek": 1,
        "dayName": "Monday",
        "startTimeUtc": "09:00",
        "endTimeUtc": "17:00",
        "timezone": "America/New_York",
        "localStartTime": "05:00",
        "localEndTime": "13:00"
      },
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000002",
        "dayOfWeek": 2,
        "dayName": "Tuesday",
        "startTimeUtc": "09:00",
        "endTimeUtc": "17:00",
        "timezone": "America/New_York",
        "localStartTime": "05:00",
        "localEndTime": "13:00"
      }
    ]
  },
  "meta": null,
  "error": null
}
```

**Field notes**:
- `status`: the agent's manually set status (`AVAILABLE`, `BUSY`, `OFFLINE`).
- `effectiveStatus`: what the engine actually uses. This is `OFFLINE` if the current UTC time is outside all schedule windows and the manual status is not `OFFLINE`. Otherwise equals `status`.
- `schedule`: array of 0–7 items (one per configured day of week). Empty if no schedule configured.
- `localStartTime` / `localEndTime`: the start/end times converted back to the schedule's `timezone` for display; computed at read time.

**Errors**:
- `401 Unauthorized`
- `403 Forbidden` — caller is not Admin, Manager, or the agent themselves
- `404 Not Found` — agent user does not exist

---

## PUT /api/v1/agent-availability/status

**Description**: Set the calling agent's own availability status. This endpoint
is for self-service only — agents set their own status. Managers and Admins who
need to override another agent's status should contact them or use the workload
dashboard.
**Auth**: Support Agent (own status only)

**Request body**:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `status` | string | yes | `"AVAILABLE"`, `"BUSY"`, or `"OFFLINE"` |

**Response** `200 OK`:

```json
{
  "data": {
    "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
    "status": "BUSY",
    "updatedAt": "2026-06-16T12:30:00Z"
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — invalid status value
- `401 Unauthorized`
- `403 Forbidden` — caller is not a Support Agent

**Notes**: Setting `OFFLINE` manually overrides the agent's recurring schedule.
The engine will treat the agent as `OFFLINE` even during their scheduled available
window until they manually set a different status (FR-026). This change is
reflected in the assignment engine within 30 seconds (SC-004); the workload cache
is invalidated immediately on this call.

**Example**:

```json
// Request body
{ "status": "BUSY" }

// Response 200
{
  "data": {
    "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
    "status": "BUSY",
    "updatedAt": "2026-06-16T12:30:00Z"
  },
  "meta": null,
  "error": null
}
```

---

## PUT /api/v1/agent-availability/schedule

**Description**: Replace the calling agent's entire weekly availability schedule.
Existing schedule rows are deleted and replaced with the submitted array in a
single transaction. Send an empty array to remove all schedule entries.
**Auth**: Support Agent (own schedule only)

**Request body**: Array of day schedule objects. Max 7 items (one per day of week).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `dayOfWeek` | integer | yes | 0 (Sunday) – 6 (Saturday); must be unique within the array |
| `startTime` | string | yes | Local time in `HH:MM` format (24-hour); converted to UTC at save |
| `endTime` | string | yes | Local time in `HH:MM` format (24-hour); must be after `startTime` |
| `timezone` | string | yes | Valid IANA timezone string (e.g. `"America/New_York"`) |

**Response** `200 OK`:

```json
{
  "data": {
    "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
    "schedule": [
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000001",
        "dayOfWeek": 1,
        "dayName": "Monday",
        "startTimeUtc": "14:00",
        "endTimeUtc": "22:00",
        "timezone": "America/New_York",
        "localStartTime": "09:00",
        "localEndTime": "17:00"
      },
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000002",
        "dayOfWeek": 2,
        "dayName": "Tuesday",
        "startTimeUtc": "14:00",
        "endTimeUtc": "22:00",
        "timezone": "America/New_York",
        "localStartTime": "09:00",
        "localEndTime": "17:00"
      },
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000003",
        "dayOfWeek": 3,
        "dayName": "Wednesday",
        "startTimeUtc": "14:00",
        "endTimeUtc": "22:00",
        "timezone": "America/New_York",
        "localStartTime": "09:00",
        "localEndTime": "17:00"
      },
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000004",
        "dayOfWeek": 4,
        "dayName": "Thursday",
        "startTimeUtc": "14:00",
        "endTimeUtc": "22:00",
        "timezone": "America/New_York",
        "localStartTime": "09:00",
        "localEndTime": "17:00"
      },
      {
        "id": "s1a2b3c4-0000-0000-0000-000000000005",
        "dayOfWeek": 5,
        "dayName": "Friday",
        "startTimeUtc": "14:00",
        "endTimeUtc": "22:00",
        "timezone": "America/New_York",
        "localStartTime": "09:00",
        "localEndTime": "17:00"
      }
    ]
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — invalid `dayOfWeek` value; duplicate `dayOfWeek` within the array; invalid time format; `endTime` is not after `startTime`; invalid IANA timezone string; more than 7 entries
- `401 Unauthorized`
- `403 Forbidden` — caller is not a Support Agent

**Notes**: All times are submitted in the agent's local timezone and stored as
UTC using `luxon` conversion. The `startTimeUtc` and `endTimeUtc` in the response
are the stored UTC values. `localStartTime` and `localEndTime` are the original
local-time values echoed back for confirmation. Cross-midnight schedules (e.g.
`startTime: "22:00"`, `endTime: "06:00"`) are not supported in v1; `endTime` must
be strictly after `startTime` on the same calendar day.

**Example**:

```json
// Request body — Mon–Fri 09:00–17:00 America/New_York
[
  { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "timezone": "America/New_York" },
  { "dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00", "timezone": "America/New_York" },
  { "dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00", "timezone": "America/New_York" },
  { "dayOfWeek": 4, "startTime": "09:00", "endTime": "17:00", "timezone": "America/New_York" },
  { "dayOfWeek": 5, "startTime": "09:00", "endTime": "17:00", "timezone": "America/New_York" }
]
```
