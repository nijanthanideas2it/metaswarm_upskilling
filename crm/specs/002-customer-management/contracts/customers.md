# API Contracts: Customers

**Feature**: 002-customer-management
**Date**: 2026-06-16
**Base path**: `/api/v1/customers`
**Auth**: All endpoints require `Authorization: Bearer <accessToken>`
**Response envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`

All timestamps: ISO 8601 UTC. All field names: camelCase.

---

## POST /api/v1/customers

Creates a new customer profile. Triggers an invitation email to the new customer.

**Permitted roles**: Admin, Support Manager

### Request

```json
{
  "fullName": "Jane Smith",
  "email": "jane@acme.com",
  "phone": "+1 555 123 4567",
  "jobTitle": "Operations Lead",
  "organizationId": "uuid-of-org"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `fullName` | string | Yes | 1–200 chars |
| `email` | string | Yes | Valid email; unique across all users |
| `phone` | string | No | Max 30 chars; loose E.164 format |
| `jobTitle` | string | No | Max 100 chars |
| `organizationId` | string (UUID) | No | Must reference existing organisation |

### Responses

**201 Created**

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "fullName": "Jane Smith",
    "email": "jane@acme.com",
    "phone": "+1 555 123 4567",
    "jobTitle": "Operations Lead",
    "organizationId": "uuid-of-org",
    "organizationName": "Acme Corp",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "createdAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**409 Conflict** — Email already in use.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "A user with this email address already exists.",
    "details": null
  }
}
```

**403 Forbidden** — Caller role not permitted.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": null
  }
}
```

**422 Unprocessable Entity** — Validation failure.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "email", "message": "Invalid email address." }
    ]
  }
}
```

---

## GET /api/v1/customers

Returns a paginated, filterable list of all customers.

**Permitted roles**: Admin, Support Manager, Support Agent

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `pageSize` | integer | 20 | Records per page (max 100) |
| `filter[status]` | string | — | `ACTIVE` or `DEACTIVATED` |
| `filter[organizationId]` | UUID | — | Filter by organisation |
| `sort` | string | `createdAt` | `fullName`, `email`, `createdAt`; prefix `-` for descending |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "fullName": "Jane Smith",
      "email": "jane@acme.com",
      "organizationName": "Acme Corp",
      "status": "ACTIVE",
      "createdAt": "2026-06-16T10:00:00Z"
    }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true
  },
  "error": null
}
```

---

## GET /api/v1/customers/search

Searches customers by full name or email (minimum 2 characters).

**Permitted roles**: Admin, Support Manager, Support Agent

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |
| `page` | integer | No | Default 1 |
| `pageSize` | integer | No | Default 20, max 100 |

### Responses

**200 OK** — Results found.

```json
{
  "data": [
    {
      "id": "uuid",
      "fullName": "Jane Smith",
      "email": "jane@acme.com",
      "organizationName": "Acme Corp",
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false
  },
  "error": null
}
```

**422 Unprocessable Entity** — Query too short.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Search query must be at least 2 characters.",
    "details": [{ "field": "q", "message": "Minimum 2 characters required." }]
  }
}
```

---

## GET /api/v1/customers/:id

Returns the full profile of a specific customer, including ticket activity summary.

**Permitted roles**: Admin, Support Manager, Support Agent; Customer (own profile only)

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "fullName": "Jane Smith",
    "email": "jane@acme.com",
    "phone": "+1 555 123 4567",
    "jobTitle": "Operations Lead",
    "organizationId": "uuid-of-org",
    "organizationName": "Acme Corp",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "ticketSummary": {
      "totalTickets": 14,
      "openTickets": 2,
      "lastTicketAt": "2026-06-10T08:30:00Z"
    },
    "createdAt": "2026-01-15T09:00:00Z",
    "updatedAt": "2026-06-16T10:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Customer attempting to view another customer's profile.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to view this profile.",
    "details": null
  }
}
```

**404 Not Found** — Customer does not exist.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Customer not found.",
    "details": null
  }
}
```

---

## PATCH /api/v1/customers/:id

Updates a customer's profile. Field-level permissions are enforced per role.

**Permitted roles**:
- Admin: all fields including `email` and `organizationId`
- Support Manager: all fields except `email`
- Customer: only `fullName`, `phone`, `jobTitle` on own profile

### Request

```json
{
  "fullName": "Jane A. Smith",
  "phone": "+1 555 999 0000",
  "jobTitle": "Senior Operations Lead",
  "organizationId": "new-org-uuid",
  "email": "newemail@acme.com"
}
```

All fields optional; only provided fields are updated (partial update).

### Responses

**200 OK**

```json
{
  "data": {
    "id": "uuid",
    "fullName": "Jane A. Smith",
    "email": "newemail@acme.com",
    "phone": "+1 555 999 0000",
    "jobTitle": "Senior Operations Lead",
    "organizationId": "new-org-uuid",
    "organizationName": "Acme Corp",
    "status": "ACTIVE",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Role does not permit the requested field change.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to update this field.",
    "details": [{ "field": "email", "message": "Only Admins may change a customer's email address." }]
  }
}
```

---

## POST /api/v1/customers/:id/deactivate

Deactivates a customer account. The customer can no longer log in.

**Permitted roles**: Admin only

### Request

*(empty body)*

### Responses

**200 OK**

```json
{
  "data": {
    "id": "uuid",
    "status": "DEACTIVATED",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Caller is not Admin.

**404 Not Found** — Customer does not exist.

**409 Conflict** — Customer is already deactivated.

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "ALREADY_DEACTIVATED",
    "message": "This customer account is already deactivated.",
    "details": null
  }
}
```

---

## POST /api/v1/customers/:id/reactivate

Reactivates a previously deactivated customer account.

**Permitted roles**: Admin only

### Request

*(empty body)*

### Responses

**200 OK**

```json
{
  "data": {
    "id": "uuid",
    "status": "ACTIVE",
    "updatedAt": "2026-06-16T11:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**403 Forbidden** — Caller is not Admin.

**409 Conflict** — Customer is already active.

---

## GET /api/v1/customers/:id/audit

Returns the profile change audit trail for a customer.

**Permitted roles**: Admin only

### Query Parameters

| Parameter | Type | Default |
|-----------|------|---------|
| `page` | integer | 1 |
| `pageSize` | integer | 20 |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "fieldName": "fullName",
      "previousValue": "Jane Smith",
      "newValue": "Jane A. Smith",
      "changedBy": { "id": "uuid", "email": "admin@company.com" },
      "changedAt": "2026-06-16T11:00:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false
  },
  "error": null
}
```

---

## Common Error Codes (Customers)

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `EMAIL_ALREADY_EXISTS` | 409 | Duplicate email on create |
| `NOT_FOUND` | 404 | Customer ID not found |
| `FORBIDDEN` | 403 | Role not permitted for action or field |
| `ALREADY_DEACTIVATED` | 409 | Deactivate called on already-deactivated account |
| `ALREADY_ACTIVE` | 409 | Reactivate called on already-active account |
| `VALIDATION_ERROR` | 422 | Request body failed schema validation |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INTERNAL_ERROR` | 500 | Unexpected server fault |
