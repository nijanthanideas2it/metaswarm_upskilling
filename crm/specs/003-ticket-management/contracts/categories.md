# API Contracts: Ticket Categories

**Feature**: 003-ticket-management
**Date**: 2026-06-16
**Base path**: `/api/v1/ticket-categories`
**Auth**: `Authorization: Bearer <accessToken>` required

---

## GET /api/v1/ticket-categories

Returns all active categories (for use in ticket create/update selectors).

**Permitted roles**: All authenticated roles.

### Response — 200 OK

```json
{
  "data": [
    { "id": "uuid", "name": "Technical Support" },
    { "id": "uuid", "name": "Billing" },
    { "id": "uuid", "name": "General Inquiry" }
  ],
  "meta": null,
  "error": null
}
```

---

## GET /api/v1/ticket-categories/all

Returns all categories including deactivated ones (for admin management).

**Permitted roles**: Admin only.

### Response — 200 OK

```json
{
  "data": [
    { "id": "uuid", "name": "Technical Support", "isActive": true, "createdAt": "2026-01-01T00:00:00Z" },
    { "id": "uuid", "name": "Legacy Queries", "isActive": false, "createdAt": "2025-01-01T00:00:00Z" }
  ],
  "meta": null,
  "error": null
}
```

---

## POST /api/v1/ticket-categories

Creates a new ticket category.

**Permitted roles**: Admin only.

### Request

```json
{ "name": "Feature Request" }
```

### Responses

**201 Created** — `{ "data": { "id": "uuid", "name": "Feature Request", "isActive": true }, ... }`

**409 Conflict** — Name already exists:
```json
{ "data": null, "meta": null, "error": { "code": "NAME_ALREADY_EXISTS", "message": "A category with this name already exists.", "details": null } }
```

---

## PATCH /api/v1/ticket-categories/:id

Renames an existing category.

**Permitted roles**: Admin only.

### Request

```json
{ "name": "Feature Requests" }
```

### Response — 200 OK — `{ "data": { "id": "uuid", "name": "Feature Requests", "isActive": true }, ... }`

---

## POST /api/v1/ticket-categories/:id/deactivate

Deactivates a category. Existing tickets retain the category label.

**Permitted roles**: Admin only.

### Request — empty body

### Response — 200 OK

```json
{ "data": { "id": "uuid", "name": "Legacy Queries", "isActive": false }, "meta": null, "error": null }
```

**409 Conflict** — Category is already deactivated.
