# API Contract: Workload Dashboard

**Feature**: 004-ticket-assignment
**Date**: 2026-06-16
**Base path**: `/api/v1/workload`
**Auth**: All endpoints require a valid JWT Bearer token.

---

## GET /api/v1/workload

**Description**: Return a workload summary for all active Support Agents, showing
each agent's current availability status, open/in-progress ticket counts, and
team memberships. Results are served from a 25-second in-memory cache per the
research decision (Decision 6). The cache is invalidated immediately when any
agent changes their availability status; otherwise entries expire naturally at 25
seconds.

Supports optional filtering by team to show only members of a specific team.

**Auth**: Admin, Manager

**Query parameters**:

| Parameter | Type | Required | Default | Constraints |
|-----------|------|----------|---------|-------------|
| `teamId` | UUID string | no | (all agents shown) | Must be an existing team ID if provided |

**Response** `200 OK`:

```json
{
  "data": {
    "agents": [
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
        "name": "Alice Nguyen",
        "email": "alice@co.com",
        "availabilityStatus": "AVAILABLE",
        "effectiveStatus": "AVAILABLE",
        "openTicketCount": 3,
        "inProgressTicketCount": 1,
        "totalActiveTicketCount": 4,
        "teams": [
          {
            "teamId": "e3a1c2d4-5678-4abc-9def-000000000001",
            "teamName": "Technical Support"
          },
          {
            "teamId": "f4b2d3e5-6789-5bcd-aef0-000000000002",
            "teamName": "Enterprise Accounts"
          }
        ]
      },
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000002",
        "name": "Bob Kim",
        "email": "bob@co.com",
        "availabilityStatus": "BUSY",
        "effectiveStatus": "BUSY",
        "openTicketCount": 7,
        "inProgressTicketCount": 2,
        "totalActiveTicketCount": 9,
        "teams": [
          {
            "teamId": "e3a1c2d4-5678-4abc-9def-000000000001",
            "teamName": "Technical Support"
          }
        ]
      },
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000003",
        "name": "Carol Patel",
        "email": "carol@co.com",
        "availabilityStatus": "AVAILABLE",
        "effectiveStatus": "OFFLINE",
        "openTicketCount": 0,
        "inProgressTicketCount": 0,
        "totalActiveTicketCount": 0,
        "teams": [
          {
            "teamId": "f4b2d3e5-6789-5bcd-aef0-000000000002",
            "teamName": "Enterprise Accounts"
          }
        ]
      }
    ],
    "summary": {
      "totalAgents": 3,
      "availableCount": 1,
      "busyCount": 1,
      "offlineCount": 1,
      "totalOpenTickets": 10,
      "totalInProgressTickets": 3,
      "cachedAt": "2026-06-16T14:00:00Z",
      "cacheExpiresAt": "2026-06-16T14:00:25Z"
    }
  },
  "meta": null,
  "error": null
}
```

**Errors**:
- `400 Bad Request` — `teamId` is not a valid UUID
- `401 Unauthorized` — missing or invalid token
- `403 Forbidden` — caller is not Admin or Manager
- `404 Not Found` — `teamId` provided but no team with that ID exists

**Field notes**:

| Field | Description |
|-------|-------------|
| `availabilityStatus` | The agent's manually set status (`AVAILABLE`, `BUSY`, `OFFLINE`). |
| `effectiveStatus` | What the auto-assignment engine actually uses. `OFFLINE` if current UTC time is outside the agent's schedule window; otherwise equals `availabilityStatus`. |
| `openTicketCount` | Tickets assigned to this agent where `status = 'OPEN'`. |
| `inProgressTicketCount` | Tickets assigned to this agent where `status = 'IN_PROGRESS'`. |
| `totalActiveTicketCount` | Sum of `openTicketCount + inProgressTicketCount`. Used by the engine for workload balancing. |
| `teams` | All active teams the agent belongs to. Empty array if the agent is not a member of any team. |
| `summary.availableCount` | Count of agents whose `effectiveStatus = 'AVAILABLE'`. |
| `summary.cachedAt` | UTC timestamp when the cached result was computed. |
| `summary.cacheExpiresAt` | UTC timestamp at which the cache entry expires (25 seconds after `cachedAt`). |

**Filtering behaviour**: When `?teamId=<uuid>` is provided, only agents who are
members of that team are included in `data.agents`. The `summary` counts reflect
only the filtered agent set. The cache key is namespaced per team filter
(`"workload:teamId:<uuid>"`), so team-filtered and unfiltered views are cached
independently.

**Performance**: Backed by a single `$queryRaw` JOIN query across `User`,
`TeamMembership`, `AgentAvailability`, and `Ticket` tables. Results load in ≤3 s
for up to 500 agents (SC-002). Clients should poll at a 25–30 second interval
to stay within the freshness window (FR-030).

**Example — unfiltered**:

```
GET /api/v1/workload
Authorization: Bearer <manager-token>
```

```json
{
  "data": {
    "agents": [
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
        "name": "Alice Nguyen",
        "email": "alice@co.com",
        "availabilityStatus": "AVAILABLE",
        "effectiveStatus": "AVAILABLE",
        "openTicketCount": 3,
        "inProgressTicketCount": 1,
        "totalActiveTicketCount": 4,
        "teams": [
          { "teamId": "e3a1c2d4-5678-4abc-9def-000000000001", "teamName": "Technical Support" }
        ]
      },
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000002",
        "name": "Bob Kim",
        "email": "bob@co.com",
        "availabilityStatus": "BUSY",
        "effectiveStatus": "BUSY",
        "openTicketCount": 7,
        "inProgressTicketCount": 2,
        "totalActiveTicketCount": 9,
        "teams": [
          { "teamId": "e3a1c2d4-5678-4abc-9def-000000000001", "teamName": "Technical Support" }
        ]
      }
    ],
    "summary": {
      "totalAgents": 2,
      "availableCount": 1,
      "busyCount": 1,
      "offlineCount": 0,
      "totalOpenTickets": 10,
      "totalInProgressTickets": 3,
      "cachedAt": "2026-06-16T14:00:00Z",
      "cacheExpiresAt": "2026-06-16T14:00:25Z"
    }
  },
  "meta": null,
  "error": null
}
```

**Example — filtered by team**:

```
GET /api/v1/workload?teamId=e3a1c2d4-5678-4abc-9def-000000000001
Authorization: Bearer <manager-token>
```

```json
{
  "data": {
    "agents": [
      {
        "agentId": "a1b2c3d4-0000-0000-0000-000000000001",
        "name": "Alice Nguyen",
        "email": "alice@co.com",
        "availabilityStatus": "AVAILABLE",
        "effectiveStatus": "AVAILABLE",
        "openTicketCount": 3,
        "inProgressTicketCount": 1,
        "totalActiveTicketCount": 4,
        "teams": [
          { "teamId": "e3a1c2d4-5678-4abc-9def-000000000001", "teamName": "Technical Support" }
        ]
      }
    ],
    "summary": {
      "totalAgents": 1,
      "availableCount": 1,
      "busyCount": 0,
      "offlineCount": 0,
      "totalOpenTickets": 3,
      "totalInProgressTickets": 1,
      "cachedAt": "2026-06-16T14:00:00Z",
      "cacheExpiresAt": "2026-06-16T14:00:25Z"
    }
  },
  "meta": null,
  "error": null
}
```

**Client integration notes**:

1. **Polling**: Poll at 25–30 second intervals. The `cacheExpiresAt` field can
   be used by the client to schedule the next refresh precisely.
2. **Agent drill-down**: Clicking an agent row navigates to
   `GET /api/v1/tickets?assignedAgentId=<agentId>&status=OPEN,IN_PROGRESS`
   (from the `003-ticket-management` contract). There is no separate drill-down
   endpoint in this module (FR-031 — navigation is handled at the client layer).
3. **Cache invalidation**: When the manager is viewing the workload dashboard and
   an agent sets themselves BUSY or AVAILABLE, the next poll (within 25 seconds)
   will return the updated data because the cache is invalidated on status change.
   For immediate refresh, the client may re-request the endpoint without waiting
   for the poll interval.
