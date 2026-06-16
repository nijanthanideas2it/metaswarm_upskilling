# API Contracts: Organizations

**Feature**: 002-customer-management
**Date**: 2026-06-16
**Base path**: `/api/v1/organizations`
**Auth**: All endpoints require `Authorization: Bearer <accessToken>`
**Response envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`

All timestamps: ISO 8601 UTC. All field names: camelCase.

---

## POST /api/v1/organizations

Creates a new organisation profile.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "name": "Acme Corp",
  "emailDomain": "acme.com",
  "industry": "Manufacturing",
  "primaryContactId": "uuid-of-customer"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | 1–200 chars; unique (case-insensitive) |
| `emailDomain` | string | No | Valid domain format (`domain.tld`); max 253 chars |
| `industry` | string | No | Max 100 chars |
| `primaryContactId` | UUID | No | Must reference an existing active Customer |

### Responses

**201 Created**

```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "emailDomain": "acme.com",
    "industry": "Manufacturing",
    "primaryContactId": "uuid-of-customer",
    "memberCount": 0,
    "createdAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**409 Conflict** — Organisation name already exists.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "NAME_ALREADY_EXISTS",
    "message": "An organisation with this name already exists.",
    "details": null
  }
}
```

**403 Forbidden** — Caller role not permitted.

**422 Unprocessable Entity** — Validation failure.

---

## GET /api/v1/organizations

Returns a paginated list of all organisations.

**Permitted roles**: Admin, Support Manager, Support Agent

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Max 100 |
| `sort` | string | `name` | `name`, `createdAt`; prefix `-` for descending |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "emailDomain": "acme.com",
      "industry": "Manufacturing",
      "memberCount": 12,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 8,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false
  },
  "error": null
}
```

---

## GET /api/v1/organizations/:id

Returns the full organisation profile including member list and ticket activity summary.

**Permitted roles**: Admin, Support Manager, Support Agent

### Query Parameters (member list pagination)

| Parameter | Type | Default |
|-----------|------|---------|
| `membersPage` | integer | 1 |
| `membersPageSize` | integer | 20 |

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "emailDomain": "acme.com",
    "industry": "Manufacturing",
    "primaryContact": {
      "id": "uuid",
      "fullName": "Jane Smith",
      "email": "jane@acme.com"
    },
    "ticketSummary": {
      "totalOpenTickets": 5,
      "lastTicketAt": "2026-06-14T14:00:00Z"
    },
    "members": [
      {
        "id": "uuid",
        "fullName": "Jane Smith",
        "email": "jane@acme.com",
        "status": "ACTIVE"
      }
    ],
    "membersMeta": {
      "total": 12,
      "page": 1,
      "pageSize": 20,
      "hasNextPage": false
    },
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**404 Not Found**

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Organisation not found.",
    "details": null
  }
}
```

---

## PATCH /api/v1/organizations/:id

Updates an organisation profile.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "name": "Acme Corporation",
  "emailDomain": "acmecorp.com",
  "industry": "Technology",
  "primaryContactId": "new-uuid"
}
```

All fields optional (partial update).

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corporation",
    "emailDomain": "acmecorp.com",
    "industry": "Technology",
    "primaryContactId": "new-uuid",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

---

## DELETE /api/v1/organizations/:id

Permanently deletes an organisation. Blocked if it has any members.

**Permitted roles**: Admin only

### Response — 204 No Content

*(empty body on success)*

**409 Conflict** — Organisation still has members.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "ORGANISATION_HAS_MEMBERS",
    "message": "Cannot delete an organisation that has active members. Remove or reassign all members first.",
    "details": {
      "memberCount": 12
    }
  }
}
```

**403 Forbidden** — Caller is not Admin.

---

## POST /api/v1/organizations/:id/members

Associates an existing customer with this organisation.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "customerId": "uuid-of-customer"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `customerId` | UUID | Yes | Must reference an existing Customer |

### Responses

**200 OK**

```json
{
  "data": {
    "customerId": "uuid-of-customer",
    "organizationId": "uuid-of-org",
    "message": "Customer successfully added to organisation."
  },
  "meta": null,
  "error": null
}
```

**409 Conflict** — Customer already belongs to a different organisation.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "CUSTOMER_IN_ANOTHER_ORG",
    "message": "This customer is already a member of another organisation. Remove them from their current organisation first.",
    "details": {
      "currentOrganizationId": "uuid",
      "currentOrganizationName": "Other Corp"
    }
  }
}
```

---

## DELETE /api/v1/organizations/:id/members/:customerId

Removes a customer from this organisation (sets their `organizationId` to null).

**Permitted roles**: Admin, Support Manager

### Response — 204 No Content

*(empty body on success)*

**404 Not Found** — Customer is not a member of this organisation.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "NOT_A_MEMBER",
    "message": "This customer is not a member of the specified organisation.",
    "details": null
  }
}
```

---

## Common Error Codes (Organizations)

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `NAME_ALREADY_EXISTS` | 409 | Duplicate organisation name |
| `NOT_FOUND` | 404 | Organisation ID not found |
| `FORBIDDEN` | 403 | Role not permitted for action |
| `ORGANISATION_HAS_MEMBERS` | 409 | Delete blocked due to existing members |
| `CUSTOMER_IN_ANOTHER_ORG` | 409 | Member add blocked; customer already in another org |
| `NOT_A_MEMBER` | 404 | Member remove; customer not in this org |
| `VALIDATION_ERROR` | 422 | Request body failed schema validation |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
