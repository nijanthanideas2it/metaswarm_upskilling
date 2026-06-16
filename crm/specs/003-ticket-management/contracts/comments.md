# API Contracts: Comments & Attachments

**Feature**: 003-ticket-management
**Date**: 2026-06-16
**Base path**: `/api/v1/tickets/:ticketId/comments`
**Auth**: `Authorization: Bearer <accessToken>` required
**Envelope**: `{ "data": <payload|null>, "meta": <object|null>, "error": <object|null> }`

---

## GET /api/v1/tickets/:ticketId/comments

Returns the comment thread for a ticket. Internal notes are excluded for
Customer-role callers.

**Permitted roles**: Ticket owner Customer, assigned Agent, Manager, Admin.

### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `page` | int | 1 |
| `pageSize` | int | 20 |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "authorId": "uuid",
      "authorName": "Bob Agent",
      "authorRole": "SUPPORT_AGENT",
      "body": "I've reproduced the issue and am investigating.",
      "isInternalNote": false,
      "attachments": [
        {
          "id": "uuid",
          "fileName": "screenshot.png",
          "mimeType": "image/png",
          "fileSizeBytes": 204800,
          "downloadUrl": "https://storage.example.com/presigned-get-url"
        }
      ],
      "createdAt": "2026-06-16T11:30:00Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "pageSize": 20, "hasNextPage": false },
  "error": null
}
```

> `isInternalNote` field is omitted from the response when the caller is a Customer.

---

## POST /api/v1/tickets/:ticketId/comments

Adds a new comment to the ticket thread. Attachment IDs reference previously
confirmed uploads (see presigned-URL flow below).

**Permitted roles**: Ticket owner Customer, any Agent, Manager, Admin.
Customers MUST NOT set `isInternalNote: true` (rejected with 403).
CLOSED/CANCELLED tickets reject new comments (409).

### Request

```json
{
  "body": "I've attached the error log. Let me know what you find.",
  "isInternalNote": false,
  "attachmentIds": ["uuid-of-confirmed-attachment"]
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `body` | string | Yes | 1–10,000 chars |
| `isInternalNote` | boolean | No | Default false; forbidden for Customer role |
| `attachmentIds` | UUID[] | No | Max 5; each must be a confirmed attachment |

### Responses

**201 Created**

```json
{
  "data": {
    "id": "uuid",
    "authorId": "uuid",
    "authorName": "Jane Smith",
    "authorRole": "CUSTOMER",
    "body": "I've attached the error log.",
    "isInternalNote": false,
    "attachments": [],
    "createdAt": "2026-06-16T12:00:00Z"
  },
  "meta": null,
  "error": null
}
```

**409 Conflict** — Ticket is CLOSED or CANCELLED:
```json
{
  "data": null, "meta": null,
  "error": { "code": "TICKET_CLOSED", "message": "Comments cannot be added to a closed or cancelled ticket.", "details": null }
}
```

**403 Forbidden** — Customer attempted to set `isInternalNote: true`.

> **Status side-effects** (handled in use case, transparent to caller):
> - Customer comment on PENDING ticket → ticket transitions to IN_PROGRESS
> - Customer comment on RESOLVED ticket → ticket transitions to IN_PROGRESS
> - Agent comment does NOT change PENDING status

---

## POST /api/v1/tickets/:ticketId/comments/attachments/presigned-url

Generates a presigned S3 PUT URL for a single file upload. Must be called
before uploading; validates file metadata before the upload occurs.

**Permitted roles**: Same as POST /comments

### Request

```json
{
  "fileName": "error-log.txt",
  "mimeType": "text/plain",
  "fileSizeBytes": 51200
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `fileName` | string | Yes | Max 255 chars |
| `mimeType` | string | Yes | Must be in the allowed MIME type list |
| `fileSizeBytes` | int | Yes | Must be ≤ 10,485,760 (10 MB) |

### Response — 200 OK

```json
{
  "data": {
    "attachmentId": "uuid",
    "presignedUrl": "https://s3.amazonaws.com/bucket/key?X-Amz-Signature=...",
    "expiresAt": "2026-06-16T12:15:00Z",
    "storageKey": "attachments/uuid/error-log.txt"
  },
  "meta": null,
  "error": null
}
```

**422** — File too large or unsupported type:
```json
{
  "data": null, "meta": null,
  "error": {
    "code": "INVALID_ATTACHMENT",
    "message": "File exceeds the 10 MB size limit.",
    "details": { "maxBytes": 10485760, "providedBytes": 15000000 }
  }
}
```

---

## POST /api/v1/tickets/:ticketId/comments/attachments/:attachmentId/confirm

Confirms that the client has successfully uploaded the file to S3. Creates
the final `TicketAttachment` record. Must be called before including the
`attachmentId` in a comment submission.

**Permitted roles**: Same as POST /comments

### Request — empty body

### Response — 200 OK

```json
{
  "data": {
    "id": "uuid",
    "fileName": "error-log.txt",
    "mimeType": "text/plain",
    "fileSizeBytes": 51200,
    "confirmed": true
  },
  "meta": null,
  "error": null
}
```

**404** — Attachment ID not found or expired presigned URL window.

**409** — Already confirmed.
