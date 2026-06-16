# API Contracts: Escalation Policies

**Feature**: 005-escalation-management
**Date**: 2026-06-16
**Base path**: `/api/v1/escalation-policies`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`
Timestamps: ISO 8601 UTC. Fields: camelCase.

**Permitted roles** (unless noted per-endpoint):
- `ADMIN` — full access
- `SUPPORT_MANAGER` — full access
- `SUPPORT_AGENT` — read-only (GET endpoints only)
- `CUSTOMER` — no access (403 on all endpoints)

---

## POST /api/v1/escalation-policies

Creates a new escalation policy in inactive state. Tiers are added separately.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "name": "Critical Response",
  "description": "Fires on CRITICAL tickets that go unanswered.",
  "scopeCategories": ["uuid-category-billing"],
  "scopePriorities": ["CRITICAL", "HIGH"]
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | Yes | 1–150 chars; unique across all policies |
| `description` | string | No | Max 500 chars |
| `scopeCategories` | UUID[] | No | Array of active TicketCategory IDs; `[]` = all categories |
| `scopePriorities` | string[] | No | Subset of `["LOW","MEDIUM","HIGH","CRITICAL"]`; `[]` = all priorities |

### Response — 201 Created

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Critical Response",
    "description": "Fires on CRITICAL tickets that go unanswered.",
    "scopeCategories": ["uuid-category-billing"],
    "scopePriorities": ["CRITICAL", "HIGH"],
    "isActive": false,
    "tierCount": 0,
    "createdAt": "2026-06-16T09:00:00Z",
    "updatedAt": "2026-06-16T09:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**409 Conflict** — Name already in use:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "POLICY_NAME_CONFLICT", "message": "An escalation policy with this name already exists.", "details": null }
}
```

**422 Unprocessable** — Validation failure:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed.", "details": [{ "field": "name", "issue": "Name must be between 1 and 150 characters." }] }
}
```

---

## GET /api/v1/escalation-policies

Paginated list of all escalation policies visible to the caller.

**Permitted roles**: Admin, Support Manager, Support Agent

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | 1-based page number |
| `pageSize` | int | 20 | Max 100 |
| `filter[isActive]` | boolean | — | `true` = active only; `false` = inactive only; omit = all |
| `filter[name]` | string | — | Substring match (case-insensitive) |
| `sort` | string | `name` | `name`, `-name`, `createdAt`, `-createdAt` |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Critical Response",
      "description": "Fires on CRITICAL tickets that go unanswered.",
      "scopeCategories": ["uuid-category-billing"],
      "scopePriorities": ["CRITICAL", "HIGH"],
      "isActive": true,
      "tierCount": 2,
      "createdAt": "2026-06-16T09:00:00Z",
      "updatedAt": "2026-06-16T09:05:00Z"
    }
  ],
  "meta": { "total": 12, "page": 1, "pageSize": 20, "hasNextPage": false },
  "error": null
}
```

---

## GET /api/v1/escalation-policies/:id

Full policy detail including all tiers and their actions.

**Permitted roles**: Admin, Support Manager, Support Agent

### Response — 200 OK

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Critical Response",
    "description": "Fires on CRITICAL tickets that go unanswered.",
    "scopeCategories": [
      { "id": "uuid-category-billing", "name": "Billing" }
    ],
    "scopePriorities": ["CRITICAL", "HIGH"],
    "isActive": true,
    "createdAt": "2026-06-16T09:00:00Z",
    "updatedAt": "2026-06-16T09:05:00Z",
    "tiers": [
      {
        "id": "tier-uuid-1",
        "ordinal": 1,
        "triggerCondition": "TIME_SINCE_CREATION",
        "thresholdHours": 4,
        "actions": [
          {
            "id": "action-uuid-1",
            "actionType": "NOTIFY_ROLE",
            "targetRole": "SUPPORT_MANAGER",
            "targetUser": null
          }
        ]
      },
      {
        "id": "tier-uuid-2",
        "ordinal": 2,
        "triggerCondition": "TIME_SINCE_CREATION",
        "thresholdHours": 8,
        "actions": [
          {
            "id": "action-uuid-2",
            "actionType": "NOTIFY_ROLE",
            "targetRole": "ADMIN",
            "targetUser": null
          },
          {
            "id": "action-uuid-3",
            "actionType": "ELEVATE_PRIORITY",
            "targetRole": null,
            "targetUser": null
          }
        ]
      }
    ]
  },
  "meta": null,
  "error": null
}
```

**404** — Policy not found:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "NOT_FOUND", "message": "Escalation policy not found.", "details": null }
}
```

---

## PATCH /api/v1/escalation-policies/:id

Updates policy metadata (name, description, scope). All fields optional (partial
update). An **active** policy cannot have its scope changed — deactivate first.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "name": "Critical Response v2",
  "description": "Updated description.",
  "scopeCategories": [],
  "scopePriorities": ["CRITICAL"]
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | No | 1–150 chars; must remain unique |
| `description` | string | No | Max 500 chars; send `null` to clear |
| `scopeCategories` | UUID[] | No | Replaces existing scope; `[]` = all categories |
| `scopePriorities` | string[] | No | Replaces existing scope; `[]` = all priorities |

### Response — 200 OK — returns updated policy in GET /:id shape

**409** — Policy is active (scope change blocked):
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "POLICY_ACTIVE", "message": "Deactivate the policy before changing its scope.", "details": null }
}
```

---

## DELETE /api/v1/escalation-policies/:id

Permanently deletes a policy. Blocked if the policy is currently active.

**Permitted roles**: Admin only

### Response — 204 No Content

**409 Conflict** — Policy is active:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "POLICY_ACTIVE", "message": "Deactivate the policy before deleting it.", "details": null }
}
```

---

## POST /api/v1/escalation-policies/:id/activate

Activates a policy so it participates in evaluation cycles. The policy must
have at least one tier configured.

**Permitted roles**: Admin, Support Manager

### Request — empty body

### Response — 200 OK

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "isActive": true,
    "updatedAt": "2026-06-16T09:10:00Z"
  },
  "meta": null,
  "error": null
}
```

**422** — No tiers configured:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "POLICY_NO_TIERS", "message": "A policy must have at least one tier before it can be activated.", "details": null }
}
```

---

## POST /api/v1/escalation-policies/:id/deactivate

Deactivates a policy; it will no longer be evaluated on subsequent cycles.
Historical escalation events fired under this policy are retained.

**Permitted roles**: Admin, Support Manager

### Request — empty body

### Response — 200 OK

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "isActive": false,
    "updatedAt": "2026-06-16T09:15:00Z"
  },
  "meta": null,
  "error": null
}
```

---

## POST /api/v1/escalation-policies/:id/tiers

Adds a new tier to the policy. The policy must be **inactive** when adding tiers.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "ordinal": 1,
  "triggerCondition": "TIME_SINCE_CREATION",
  "thresholdHours": 4,
  "actions": [
    {
      "actionType": "NOTIFY_USER",
      "targetUserId": "uuid-of-on-call-manager"
    },
    {
      "actionType": "NOTIFY_ROLE",
      "targetRole": "SUPPORT_MANAGER"
    }
  ]
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `ordinal` | int | Yes | 1–5; unique within the policy |
| `triggerCondition` | string | Yes | `TIME_SINCE_CREATION`, `TIME_SINCE_LAST_COMMENT`, `TIME_UNASSIGNED` |
| `thresholdHours` | int | Yes | ≥ 1; must be greater than the threshold of the preceding ordinal |
| `actions` | array | Yes | 1+ items |
| `actions[].actionType` | string | Yes | `NOTIFY_USER`, `NOTIFY_ROLE`, `REASSIGN`, `ELEVATE_PRIORITY` |
| `actions[].targetUserId` | UUID | Conditional | Required for `NOTIFY_USER`, `REASSIGN` |
| `actions[].targetRole` | string | Conditional | Required for `NOTIFY_ROLE`; `SUPPORT_MANAGER` or `ADMIN` |

### Response — 201 Created

```json
{
  "data": {
    "id": "tier-uuid-1",
    "policyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "ordinal": 1,
    "triggerCondition": "TIME_SINCE_CREATION",
    "thresholdHours": 4,
    "actions": [
      {
        "id": "action-uuid-1",
        "actionType": "NOTIFY_USER",
        "targetUser": { "id": "uuid-of-on-call-manager", "name": "On-Call Manager" },
        "targetRole": null
      },
      {
        "id": "action-uuid-2",
        "actionType": "NOTIFY_ROLE",
        "targetRole": "SUPPORT_MANAGER",
        "targetUser": null
      }
    ]
  },
  "meta": null,
  "error": null
}
```

**409** — Ordinal already in use for this policy:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "TIER_ORDINAL_CONFLICT", "message": "Tier ordinal 1 already exists for this policy.", "details": null }
}
```

**409** — Policy is active:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "POLICY_ACTIVE", "message": "Deactivate the policy before adding tiers.", "details": null }
}
```

**422** — Threshold ordering violation:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "THRESHOLD_ORDER_VIOLATION", "message": "Tier 2 threshold (4h) must be greater than Tier 1 threshold (4h).", "details": null }
}
```

---

## PATCH /api/v1/escalation-policies/:id/tiers/:tierId

Updates a tier's trigger condition, threshold, or actions. The policy must be
**inactive** when updating tiers.

**Permitted roles**: Admin, Support Manager

### Request — all fields optional

```json
{
  "triggerCondition": "TIME_SINCE_LAST_COMMENT",
  "thresholdHours": 6,
  "actions": [
    { "actionType": "NOTIFY_ROLE", "targetRole": "SUPPORT_MANAGER" },
    { "actionType": "ELEVATE_PRIORITY" }
  ]
}
```

> **Note**: Providing `actions` replaces ALL existing actions for the tier
> (full replacement, not append).

### Response — 200 OK — returns updated tier in POST /tiers shape

---

## DELETE /api/v1/escalation-policies/:id/tiers/:tierId

Removes a tier and its actions. The policy must be **inactive**. A policy must
retain at least one tier (deletion of the last tier is blocked).

**Permitted roles**: Admin, Support Manager

### Response — 204 No Content

**409** — Policy is active:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "POLICY_ACTIVE", "message": "Deactivate the policy before removing tiers.", "details": null }
}
```

**422** — Last remaining tier:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "LAST_TIER", "message": "Cannot remove the only tier from a policy. Delete the policy instead.", "details": null }
}
```

---

## Common Error Codes (Escalation Policies)

| Code | HTTP | Meaning |
|------|------|---------|
| `POLICY_NAME_CONFLICT` | 409 | Policy name already exists |
| `POLICY_ACTIVE` | 409 | Operation blocked because policy is currently active |
| `POLICY_NO_TIERS` | 422 | Activation attempted with zero tiers |
| `TIER_ORDINAL_CONFLICT` | 409 | Ordinal already exists on this policy |
| `THRESHOLD_ORDER_VIOLATION` | 422 | Tier threshold ≤ preceding tier's threshold |
| `LAST_TIER` | 422 | Cannot delete the last tier; delete policy instead |
| `NOT_FOUND` | 404 | Policy or tier ID not found |
| `FORBIDDEN` | 403 | Role not permitted for this operation |
| `VALIDATION_ERROR` | 422 | Request body schema failure |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
