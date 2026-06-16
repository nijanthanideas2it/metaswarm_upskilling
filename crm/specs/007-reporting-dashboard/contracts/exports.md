# API Contracts: Report Exports

**Feature**: 007-reporting-dashboard
**Date**: 2026-06-16
**Base path**: `/api/v1/reports`
**Auth**: `Authorization: Bearer <accessToken>` required on all endpoints

Export endpoints deviate from the standard JSON envelope. On success they
return a **binary stream** with the appropriate `Content-Type`. On failure
they return the standard JSON error envelope.

**Access control**:
- CSV export (`/exports/csv`) — Admin, Support Manager
- PDF export (`/exports/pdf`) — Admin only
- Agent personal summary export (`/performance/me/exports/csv`) — Admin,
  Support Manager, Support Agent (own data only)

---

## GET /api/v1/reports/overview/exports/csv

Downloads the current operations overview as CSV.

**Permitted roles**: Admin, Support Manager

### Query Parameters

None (snapshot from most recent cache entry; same data as `GET /reports/overview`).

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-overview-2026-06-16.csv
```

**Body** (example):

```csv
section,label,value
statusCounts,OPEN,14
statusCounts,IN_PROGRESS,8
statusCounts,PENDING,3
statusCounts,RESOLVED_THIS_WEEK,22
statusCounts,CLOSED_THIS_WEEK,17
priorityCounts,CRITICAL,2
priorityCounts,HIGH,5
priorityCounts,MEDIUM,9
priorityCounts,LOW,6
categoryCounts,Technical Support,12
categoryCounts,Billing,5
categoryCounts,Uncategorised,3
atRiskTickets,referenceNumber|customerName|priority|hoursSinceCreation,TKT-00042|Jane Smith|HIGH|27.4
```

### Error Responses

**403** — Role not permitted (standard JSON envelope):

```json
{
  "data": null,
  "meta": null,
  "error": { "code": "FORBIDDEN", "message": "You do not have permission to export this report.", "details": null }
}
```

---

## GET /api/v1/reports/volume/exports/csv

Downloads the ticket volume report for a date range as CSV.

**Permitted roles**: Admin, Support Manager

### Query Parameters

Same as `GET /reports/volume` (all params including filters).

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |
| `filter[categoryId]` | UUID | No | |
| `filter[priority]` | string | No | |
| `filter[organizationId]` | UUID | No | |

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-volume-2026-06-16.csv
```

**Body** (example — weekly granularity):

```csv
bucket,createdCount,resolvedCount
2026-05-18T00:00:00Z,42,38
2026-05-25T00:00:00Z,39,35
2026-06-01T00:00:00Z,51,47
2026-06-08T00:00:00Z,37,27
2026-06-15T00:00:00Z,15,14
```

**Notes**:
- Zero-count buckets (gap-filled) are included.
- Granularity (WEEKLY / MONTHLY) is noted in the filename suffix when applicable.

### Timeout — 408 Request Timeout

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "EXPORT_TIMEOUT",
    "message": "Export exceeded the 60-second limit. Try narrowing the date range.",
    "details": null
  }
}
```

---

## GET /api/v1/reports/performance/exports/csv

Downloads the full agent performance report as CSV.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |
| `sort` | string | No | `name` (default), `-ticketsHandled`, `-avgResolutionHours` |

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-performance-2026-06-16.csv
```

**Body**:

```csv
agentId,agentName,isDeactivated,ticketsHandled,ticketsResolved,avgFirstResponseHours,avgResolutionHours,exceedsThreshold,exceededPriority
uuid,Bob Agent,false,42,38,1.4,6.2,true,HIGH
uuid,Carol Support,false,27,25,0.8,4.1,false,
```

**Notes**:
- `exceededPriority` is empty string when `exceedsThreshold` is `false`.
- `avgFirstResponseHours` and `avgResolutionHours` are empty string when the
  agent has zero resolved tickets.

### Error Responses

**403** — Agent attempting to download team report.
**408** — Export timeout (see volume export for shape).

---

## GET /api/v1/reports/performance/me/exports/csv

Downloads the requesting user's personal performance summary as CSV.

**Permitted roles**: Admin, Support Manager, Support Agent (own data only)

### Query Parameters

None.

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-performance-me-2026-06-16.csv
```

**Body**:

```csv
period,weekStartDate,ticketsHandled,ticketsResolved,avgFirstResponseHours,avgResolutionHours
currentWeek,2026-06-15,7,5,1.1,5.3
previousWeek,2026-06-08,11,10,0.9,4.7
```

---

## GET /api/v1/reports/resolution/exports/csv

Downloads the resolution time report as CSV.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-resolution-2026-06-16.csv
```

**Body**:

```csv
priority,categoryName,avgFirstResponseHours,avgResolutionHours,ticketCount,exceedsThreshold,thresholdHours
CRITICAL,Technical Support,0.5,1.8,4,true,2
HIGH,Billing,2.1,7.9,9,false,8
MEDIUM,,3.4,18.2,12,false,24
```

**Notes**: `categoryName` is empty string for uncategorised tickets.

---

## GET /api/v1/reports/escalations/exports/csv

Downloads the escalation report as CSV.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |
| `type` | string | No | `ALL` (default), `AUTO`, `MANUAL` |

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-escalations-2026-06-16.csv
```

**Body** (summary rows, then breakdown):

```csv
metric,value
totalEscalations,17
autoEscalations,11
manualEscalations,6
avgDurationHours,4.3
escalationRatePct,9.2

section,id,name,count
byPolicy,uuid,SLA Breach Auto-Escalate,11
byAgent,uuid,Bob Agent,4
byAgent,uuid,Carol Support,2
```

---

## GET /api/v1/reports/customers/exports/csv

Downloads the customer activity report as CSV.

**Permitted roles**: Admin, Support Manager

### Query Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `startDate` | string (date) | Yes | ISO 8601 date |
| `endDate` | string (date) | Yes | ISO 8601 date; max 365 days |
| `topN` | integer | No | 5-50; default 10 |

### Success Response — 200 OK

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename=report-customers-2026-06-16.csv
```

**Body**:

```csv
rank,organizationId,organizationName,openTicketCount,totalTicketCount
1,uuid,Acme Corp,14,38
2,uuid,Globex Ltd,9,22
```

---

## GET /api/v1/reports/overview/exports/pdf

Downloads the operations overview as a formatted PDF. Admin only.

**Permitted roles**: Admin only

### Query Parameters

None.

### Success Response — 200 OK

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=report-overview-2026-06-16.pdf
```

**Body**: Binary PDF stream containing:
- Page header: report title, generated timestamp, date range label
- Section: Status Counts table
- Section: Priority Counts table
- Section: Category Counts table
- Section: At-Risk Tickets table (columns: Reference, Customer, Priority, Category, Hours Waiting)

**Notes**:
- Page size: A4 (595 pt x 842 pt); 40 pt margins.
- Font size: 10 pt for table body; reduced to 8 pt if the table exceeds 6
  columns.
- Long text in cells is word-wrapped; no silent truncation.

### Error Responses

**403** — Caller is not Admin:

```json
{
  "data": null,
  "meta": null,
  "error": { "code": "FORBIDDEN", "message": "PDF export is restricted to Admins.", "details": null }
}
```

**408** — Export timeout:

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "EXPORT_TIMEOUT",
    "message": "PDF generation exceeded the 60-second limit. Try narrowing the date range.",
    "details": null
  }
}
```

---

## GET /api/v1/reports/volume/exports/pdf

Downloads the ticket volume report as PDF. Admin only.

**Permitted roles**: Admin only

### Query Parameters

Same as `GET /reports/volume`.

### Success Response — 200 OK

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=report-volume-2026-06-16.pdf
```

**Body**: PDF with header and trend table (columns: Bucket, Created, Resolved).

---

## GET /api/v1/reports/performance/exports/pdf

Downloads the agent performance report as PDF. Admin only.

**Permitted roles**: Admin only

### Query Parameters

Same as `GET /reports/performance`.

### Success Response — 200 OK

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=report-performance-2026-06-16.pdf
```

**Body**: PDF with header and agent table (columns: Agent Name, Handled, Resolved, Avg First Response (h), Avg Resolution (h), Exceeds Threshold).

---

## GET /api/v1/reports/resolution/exports/pdf

Downloads the resolution time report as PDF. Admin only.

**Permitted roles**: Admin only

### Query Parameters

Same as `GET /reports/resolution`.

### Success Response — 200 OK

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=report-resolution-2026-06-16.pdf
```

**Body**: PDF with header and resolution table (columns: Priority, Category, Avg First Response (h), Avg Resolution (h), Ticket Count, Exceeds Threshold).

---

## GET /api/v1/reports/escalations/exports/pdf

Downloads the escalation report as PDF. Admin only.

**Permitted roles**: Admin only

### Query Parameters

Same as `GET /reports/escalations`.

### Success Response — 200 OK

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=report-escalations-2026-06-16.pdf
```

**Body**: PDF with summary table and two breakdown tables (By Policy, By Agent).

---

## GET /api/v1/reports/customers/exports/pdf

Downloads the customer activity report as PDF. Admin only.

**Permitted roles**: Admin only

### Query Parameters

Same as `GET /reports/customers`.

### Success Response — 200 OK

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=report-customers-2026-06-16.pdf
```

**Body**: PDF with header and ranked organisation table (columns: Rank, Organisation, Open Tickets, Total Tickets).

---

## Common Export Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Role not permitted for this export format or report |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `VALIDATION_ERROR` | 422 | Invalid query parameter (date range, topN, type) |
| `EXPORT_TIMEOUT` | 408 | Export exceeded 60-second limit |
| `INTERNAL_ERROR` | 500 | Unexpected server fault during generation |
