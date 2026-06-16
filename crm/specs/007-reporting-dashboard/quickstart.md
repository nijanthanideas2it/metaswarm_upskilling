# Quickstart Validation Guide: Reporting Dashboard

**Feature**: 007-reporting-dashboard
**Date**: 2026-06-16
**Depends on**: Modules 001–006 running and seeded; Prisma migration for
`ReportThresholdConfig` and the `Ticket(resolvedAt)` index applied

---

## Prerequisites

- All preceding module migrations applied: `npx prisma migrate deploy`
- Seed data present (see each scenario for exact requirements)
- Server running: `npm run dev` (or `npm start`)
- Tokens obtained:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@co.com","password":"Admin123!"}' | jq -r '.data.accessToken')

MANAGER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@co.com","password":"Manager1!"}' | jq -r '.data.accessToken')

AGENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@co.com","password":"Agent123!"}' | jq -r '.data.accessToken')

AGENT_ID=$(curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq -r '.data.id')

CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Customer1!"}' | jq -r '.data.accessToken')
```

---

## Scenario 1 — Seed Ticket Data and Verify Operations Overview Counts

**Purpose**: Validate FR-001, FR-002, FR-003, FR-004 and SC-001.

### Step 1: Create tickets across statuses and priorities

```bash
# Helper: create a ticket as customer and return its ID
create_ticket() {
  curl -s -X POST http://localhost:3000/api/v1/tickets \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"$1\",\"description\":\"Details.\",\"priority\":\"$2\"}" \
    | jq -r '.data.id'
}

T_OPEN_CRIT=$(create_ticket "Critical open issue" "CRITICAL")
T_OPEN_HIGH=$(create_ticket "High open issue" "HIGH")
T_OPEN_MED=$(create_ticket  "Medium open issue" "MEDIUM")
T_IP=$(create_ticket "In-progress ticket" "LOW")
T_PENDING=$(create_ticket "Pending ticket" "MEDIUM")

# Move T_IP to IN_PROGRESS (agent self-assigns + status)
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T_IP/self-assign" \
  -H "Authorization: Bearer $AGENT_TOKEN" > /dev/null
curl -s -X PATCH "http://localhost:3000/api/v1/tickets/$T_IP" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}' > /dev/null

# Move T_PENDING to IN_PROGRESS then PENDING
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T_PENDING/self-assign" \
  -H "Authorization: Bearer $AGENT_TOKEN" > /dev/null
curl -s -X PATCH "http://localhost:3000/api/v1/tickets/$T_PENDING" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}' > /dev/null
curl -s -X PATCH "http://localhost:3000/api/v1/tickets/$T_PENDING" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PENDING"}' > /dev/null
```

### Step 2: Fetch the operations overview as manager

```bash
curl -s http://localhost:3000/api/v1/reports/overview \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .
```

**Expected**:
- `data.statusCounts.OPEN` = 3 (the three OPEN tickets)
- `data.statusCounts.IN_PROGRESS` = 1
- `data.statusCounts.PENDING` = 1
- `data.priorityCounts.CRITICAL` = 1 (OPEN T_OPEN_CRIT)
- `data.priorityCounts.HIGH` = 1
- `data.priorityCounts.MEDIUM` = 1 (T_OPEN_MED is OPEN; T_PENDING is PENDING but also counted)
- HTTP 200; `meta` contains `cachedAt` timestamp

### Step 3: Verify at-risk tickets appear after 24 hours

For integration testing, manually update `T_OPEN_CRIT.createdAt` in the DB to
25 hours ago:

```bash
psql "$DATABASE_URL" -c "
  UPDATE \"Ticket\" SET created_at = NOW() - INTERVAL '25 hours'
  WHERE id = '$T_OPEN_CRIT';"
```

Re-fetch the overview (cache TTL is 60 s; wait 61 s or restart the server to
clear):

```bash
sleep 61
curl -s http://localhost:3000/api/v1/reports/overview \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data.atRiskTickets'
```

**Expected**: Array contains one entry with `referenceNumber` matching
`T_OPEN_CRIT`'s reference; `hoursSinceCreation` ≥ 25.

### Step 4: Confirm Customer is denied

```bash
curl -s http://localhost:3000/api/v1/reports/overview \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq .error.code
```

**Expected**: `"FORBIDDEN"`

---

## Scenario 2 — Run Agent Performance Report for a Date Range and Verify CSV Export

**Purpose**: Validate FR-009, FR-010, FR-020, SC-002, SC-003.

### Step 1: Seed performance data

Using the tickets created in Scenario 1 (or fresh tickets), ensure `$AGENT_TOKEN`
agent has at least two resolved tickets with agent comments recorded in activity
log. The setup from Scenario 1 already has one IN_PROGRESS ticket; resolve it:

```bash
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T_IP/resolve" \
  -H "Authorization: Bearer $AGENT_TOKEN" > /dev/null
```

### Step 2: Fetch the performance report

```bash
START=$(date -u -v-30d '+%Y-%m-%d' 2>/dev/null || date -u -d '30 days ago' '+%Y-%m-%d')
END=$(date -u '+%Y-%m-%d')

curl -s "http://localhost:3000/api/v1/reports/performance?startDate=${START}&endDate=${END}" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .
```

**Expected**:
- HTTP 200
- `data` is an array; the test agent appears with `ticketsHandled` ≥ 1 and
  `ticketsResolved` ≥ 1
- `avgResolutionHours` is a non-null positive number
- Any agent exceeding a threshold has `exceedsThreshold: true` and
  `exceededPriority` set

### Step 3: Verify Agent is denied

```bash
curl -s "http://localhost:3000/api/v1/reports/performance?startDate=${START}&endDate=${END}" \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq .error.code
```

**Expected**: `"FORBIDDEN"`

### Step 4: Download CSV export

```bash
curl -s -o /tmp/perf_report.csv \
  -D /tmp/perf_headers.txt \
  "http://localhost:3000/api/v1/reports/performance/exports/csv?startDate=${START}&endDate=${END}" \
  -H "Authorization: Bearer $MANAGER_TOKEN"

head -2 /tmp/perf_report.csv
grep 'Content-Disposition' /tmp/perf_headers.txt
grep 'Content-Type' /tmp/perf_headers.txt
```

**Expected**:
- Header row contains: `agentId,agentName,ticketsHandled,ticketsResolved,avgFirstResponseHours,avgResolutionHours`
- `Content-Type: text/csv`
- `Content-Disposition` matches `attachment; filename=report-performance-<YYYY-MM-DD>.csv`
- File contains at least two lines (header + one data row)
- Data values for the test agent match what was returned by the JSON endpoint in Step 2

---

## Scenario 3 — Update Resolution Thresholds and Verify Highlight in Performance Report

**Purpose**: Validate FR-023, FR-024, FR-010.

### Step 1: Fetch current thresholds (default values before first write)

```bash
curl -s http://localhost:3000/api/v1/reports/thresholds \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data
```

**Expected**: `{ criticalResolutionHours: 2, highResolutionHours: 8, mediumResolutionHours: 24, lowResolutionHours: 48 }`

### Step 2: Set a very low MEDIUM threshold so the test agent's resolution time exceeds it

```bash
curl -s -X PATCH http://localhost:3000/api/v1/reports/thresholds \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediumResolutionHours": 1}' | jq .data.mediumResolutionHours
```

**Expected**: `1`

### Step 3: Re-fetch performance report; confirm highlight appears

```bash
curl -s "http://localhost:3000/api/v1/reports/performance?startDate=${START}&endDate=${END}" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  | jq '[.data[] | select(.exceedsThreshold == true) | .agentName]'
```

**Expected**: The test agent's name appears in the array (their MEDIUM ticket
took > 1 h to resolve, which now exceeds the threshold).

### Step 4: Reset thresholds

```bash
curl -s -X PATCH http://localhost:3000/api/v1/reports/thresholds \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"criticalResolutionHours":2,"highResolutionHours":8,"mediumResolutionHours":24,"lowResolutionHours":48}' \
  | jq .data
```

**Expected**: All values restored to defaults.

### Step 5: Confirm Manager and Agent cannot update thresholds

```bash
curl -s -X PATCH http://localhost:3000/api/v1/reports/thresholds \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediumResolutionHours":1}' | jq .error.code
# Expected: "FORBIDDEN"

curl -s -X PATCH http://localhost:3000/api/v1/reports/thresholds \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediumResolutionHours":1}' | jq .error.code
# Expected: "FORBIDDEN"
```

---

## Scenario 4 — Filter Escalation Report by type=manual and Verify Count Matches Seeded Data

**Purpose**: Validate FR-015, FR-016.

### Step 1: Seed escalation events via module 005

Ensure at least two manual and one auto escalation exist in the test DB for the
current date range. Use the escalation endpoints from module 005 to trigger them,
or insert directly via the escalation module's use case in an integration test.

```bash
# Get a ticket ID for escalation (T_OPEN_HIGH from Scenario 1, still OPEN)
# Trigger a manual escalation via module 005 endpoint
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T_OPEN_HIGH/escalate" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Customer VIP escalation"}' | jq .data.id

# Trigger a second manual escalation on a different ticket
curl -s -X POST "http://localhost:3000/api/v1/tickets/$T_OPEN_MED/escalate" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"SLA breach imminent"}' | jq .data.id
```

### Step 2: Fetch escalation report — all types

```bash
curl -s "http://localhost:3000/api/v1/reports/escalations?startDate=${START}&endDate=${END}" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .data
```

**Expected**:
- `data.totalEscalations` = 2 (the two manual escalations)
- `data.escalationRatePct` is a non-null positive number
- `data.byAgent` array contains one entry for the test agent with `count: 2`
- `data.byPolicy` is an empty array (no auto escalations seeded)

### Step 3: Filter by type=manual

```bash
curl -s "http://localhost:3000/api/v1/reports/escalations?startDate=${START}&endDate=${END}&type=MANUAL" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data.totalEscalations'
```

**Expected**: Same count as Step 2 (2), because all seeded escalations are MANUAL.

### Step 4: Filter by type=AUTO

```bash
curl -s "http://localhost:3000/api/v1/reports/escalations?startDate=${START}&endDate=${END}&type=AUTO" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data.totalEscalations'
```

**Expected**: `0` — no auto escalations seeded; report returns zero values
without error.

### Step 5: Verify empty date range returns zero values (not error)

```bash
curl -s "http://localhost:3000/api/v1/reports/escalations?startDate=2020-01-01&endDate=2020-01-31" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '{status: .error, total: .data.totalEscalations}'
```

**Expected**: `{ "status": null, "total": 0 }` — zero data returns data shape
with zeros, not an error.

---

## Running the Test Suite

```bash
cd backend

# Unit tests (no DB required)
npm run test:unit

# Integration tests (real PostgreSQL)
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration

# Contract / API tests
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:contract

# Coverage gate (must be ≥ 80%)
npm run test:coverage
```

Coverage targets specific to this module:

| Test file | Minimum coverage |
|-----------|-----------------|
| `get-operations-overview.use-case.test.ts` | 90% (cache hit + miss paths) |
| `time-series-gap-filler.service.test.ts` | 95% (gap logic is pure) |
| `report-threshold-highlighter.service.test.ts` | 95% (pure function) |
| `prisma-reporting-query.repository.test.ts` | 80% (integration) |

---

## References

- Data model: [data-model.md](data-model.md)
- Report contracts: [contracts/reports.md](contracts/reports.md)
- Export contracts: [contracts/exports.md](contracts/exports.md)
- Research: [research.md](research.md)
