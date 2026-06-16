# Quickstart: Ticket Assignment Validation

**Feature**: 004-ticket-assignment
**Date**: 2026-06-16
**Depends on**: `001-user-auth`, `002-customer-management`, and `003-ticket-management`
running with their migrations applied and seed data loaded.

---

## Prerequisites

- PostgreSQL 16 running; all migrations for modules 001–004 applied:
  ```bash
  cd backend && npx prisma migrate deploy
  ```
- Server running on `localhost:3000`:
  ```bash
  npm run dev
  ```
- Seed data present: one Admin, one Manager, two Support Agents (`agent1`, `agent2`),
  one Customer account.
- `jq` installed for response parsing.

Obtain tokens and IDs for all scenarios:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@co.com","password":"Admin123!"}' | jq -r '.data.accessToken')

MANAGER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@co.com","password":"Manager1!"}' | jq -r '.data.accessToken')

AGENT1_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent1@co.com","password":"Agent123!"}' | jq -r '.data.accessToken')

AGENT2_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent2@co.com","password":"Agent123!"}' | jq -r '.data.accessToken')

CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Customer1!"}' | jq -r '.data.accessToken')

# Extract agent IDs from the user list (Admin only)
AGENT1_ID=$(curl -s "http://localhost:3000/api/v1/users?role=SUPPORT_AGENT" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data[0].id')

AGENT2_ID=$(curl -s "http://localhost:3000/api/v1/users?role=SUPPORT_AGENT" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data[1].id')

# Obtain a TicketCategory ID to use in rule conditions
CATEGORY_ID=$(curl -s "http://localhost:3000/api/v1/tickets/categories" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data[] | select(.name == "Technical Support") | .id')
```

---

## Scenario 1: Create Team, Add Members, Verify Member List

**Goal**: Confirm that a team can be created, agents added, and the member list
reflects availability status and open ticket counts.

**Steps**:

```bash
# Step 1 — Create the team (Admin)
TEAM=$(curl -s -X POST http://localhost:3000/api/v1/teams \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Technical Support","description":"Handles all technical issues"}')

echo $TEAM | jq .
TEAM_ID=$(echo $TEAM | jq -r '.data.id')
```
Expected: HTTP 201; `data.name = "Technical Support"`, `data.isActive = true`,
`data.memberCount = 0`.

```bash
# Step 2 — Add agent1 to the team (Admin)
curl -s -X POST "http://localhost:3000/api/v1/teams/$TEAM_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT1_ID\"}" | jq .
```
Expected: HTTP 201; `data.agentId` matches `$AGENT1_ID`; `data.joinedAt` is set.

```bash
# Step 3 — Add agent2 to the team (Admin)
curl -s -X POST "http://localhost:3000/api/v1/teams/$TEAM_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT2_ID\"}" | jq .
```
Expected: HTTP 201.

```bash
# Step 4 — GET team with member details (Manager)
curl -s "http://localhost:3000/api/v1/teams/$TEAM_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.data | {name, isActive, memberCount, members: [.members[] | {name, availabilityStatus, openTicketCount}]}'
```
Expected: `memberCount = 2`; both agents present in `members` array, each with
`availabilityStatus = "AVAILABLE"` (default) and `openTicketCount = 0`.

**Expected outcome**: Team exists with two members. Member list includes live
availability status and open ticket count for each agent.

---

## Scenario 2: Create Assignment Rule, Submit Matching Ticket, Verify Auto-Assignment

**Goal**: Confirm that a rule matching Category = Technical Support AND Priority =
HIGH routes a customer-submitted ticket to an available team member, and that the
activity log records the rule name.

**Steps**:

```bash
# Step 1 — Create the assignment rule (Manager)
RULE=$(curl -s -X POST http://localhost:3000/api/v1/assignment-rules \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Technical High Priority to Tech Support Team\",
    \"rank\": 10,
    \"conditions\": [
      {\"field\": \"CATEGORY\", \"operator\": \"EQUALS\", \"value\": \"$CATEGORY_ID\"},
      {\"field\": \"PRIORITY\", \"operator\": \"EQUALS\", \"value\": \"HIGH\"}
    ],
    \"targetTeamId\": \"$TEAM_ID\"
  }")

echo $RULE | jq .
RULE_ID=$(echo $RULE | jq -r '.data.id')
```
Expected: HTTP 201; `data.isActive = true`; `data.rank = 10`; `data.conditions`
contains two entries.

```bash
# Step 2 — Customer submits a matching ticket
TICKET=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Cannot access admin panel\",
    \"description\": \"Getting a 403 error on every attempt since the last deployment.\",
    \"priority\": \"HIGH\",
    \"categoryId\": \"$CATEGORY_ID\"
  }")

echo $TICKET | jq .
TICKET_ID=$(echo $TICKET | jq -r '.data.id')
```
Expected: HTTP 201; ticket created with `priority = "HIGH"` and the technical
support category.

```bash
# Step 3 — Wait up to 5 seconds, then verify assignment
sleep 1
curl -s "http://localhost:3000/api/v1/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{assignedAgentId: .data.assignedAgentId, teamId: .data.teamId}'
```
Expected: `teamId = $TEAM_ID`; `assignedAgentId` is one of `$AGENT1_ID` or
`$AGENT2_ID` (the one with fewest open tickets — both have 0, so earliest
`joinedAt` wins, which is `$AGENT1_ID`).

```bash
# Step 4 — Verify activity log contains rule name
curl -s "http://localhost:3000/api/v1/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq '.data.activityLog[] | select(.event == "AUTO_ASSIGNED") | {event, ruleName: .newValue}'
```
Expected: One `AUTO_ASSIGNED` entry with `ruleName = "Technical High Priority to Tech Support Team"`.

**Expected outcome**: Within 5 seconds of ticket creation, the ticket is team-
and agent-assigned. The activity log records the exact rule name that fired.

---

## Scenario 3: Availability Change Affects Routing

**Goal**: Confirm that when agent1 is set BUSY, a matching ticket is routed to
agent2 (the only remaining AVAILABLE member). Then confirm that restoring agent1
to AVAILABLE makes them eligible again.

**Steps**:

```bash
# Step 1 — Agent1 sets their own status to BUSY
curl -s -X PUT http://localhost:3000/api/v1/agent-availability/status \
  -H "Authorization: Bearer $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "BUSY"}' | jq '{agentId: .data.agentId, status: .data.status}'
```
Expected: HTTP 200; `status = "BUSY"`.

```bash
# Step 2 — Customer submits another matching ticket
TICKET2=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"API rate limit errors\",
    \"description\": \"Our integration is receiving 429 responses on every call.\",
    \"priority\": \"HIGH\",
    \"categoryId\": \"$CATEGORY_ID\"
  }")

TICKET2_ID=$(echo $TICKET2 | jq -r '.data.id')
sleep 1

curl -s "http://localhost:3000/api/v1/tickets/$TICKET2_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{assignedAgentId: .data.assignedAgentId, teamId: .data.teamId}'
```
Expected: `teamId = $TEAM_ID`; `assignedAgentId = $AGENT2_ID` (agent1 skipped
because BUSY).

```bash
# Step 3 — Set both agents BUSY, submit a third ticket (team-only assignment)
curl -s -X PUT http://localhost:3000/api/v1/agent-availability/status \
  -H "Authorization: Bearer $AGENT2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "BUSY"}' > /dev/null

TICKET3=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Database connection timeout\",
    \"description\": \"Production DB is throwing connection pool exhaustion errors.\",
    \"priority\": \"HIGH\",
    \"categoryId\": \"$CATEGORY_ID\"
  }")

TICKET3_ID=$(echo $TICKET3 | jq -r '.data.id')
sleep 1

curl -s "http://localhost:3000/api/v1/tickets/$TICKET3_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{assignedAgentId: .data.assignedAgentId, teamId: .data.teamId}'
```
Expected: `teamId = $TEAM_ID`; `assignedAgentId = null` (all members unavailable).

```bash
# Step 4 — Restore agent1 to AVAILABLE; submit a fourth ticket
curl -s -X PUT http://localhost:3000/api/v1/agent-availability/status \
  -H "Authorization: Bearer $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "AVAILABLE"}' > /dev/null

TICKET4=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"SSL certificate renewal needed\",
    \"description\": \"Certificate expires in 3 days — renewal process is unclear.\",
    \"priority\": \"HIGH\",
    \"categoryId\": \"$CATEGORY_ID\"
  }")

TICKET4_ID=$(echo $TICKET4 | jq -r '.data.id')
sleep 1

curl -s "http://localhost:3000/api/v1/tickets/$TICKET4_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.assignedAgentId'
```
Expected: `assignedAgentId = $AGENT1_ID` (only AVAILABLE member).

**Expected outcome**: BUSY agents are skipped by the engine. When all members are
unavailable the ticket is team-assigned only. Restoring to AVAILABLE immediately
makes an agent eligible for the next incoming ticket.

---

## Scenario 4: Rule Rank Conflict Detection and Reorder Changes Routing

**Goal**: Create two rules at the same rank, verify the conflict flag appears in
the list, reorder so the second rule takes precedence, and confirm the new top
rule fires on the next matching ticket.

**Steps**:

```bash
# Step 1 — Create a second rule at rank 10 (same as existing rule), targeting agent1 directly
RULE2=$(curl -s -X POST http://localhost:3000/api/v1/assignment-rules \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Technical High Priority Direct to Agent1\",
    \"rank\": 10,
    \"conditions\": [
      {\"field\": \"CATEGORY\", \"operator\": \"EQUALS\", \"value\": \"$CATEGORY_ID\"},
      {\"field\": \"PRIORITY\", \"operator\": \"EQUALS\", \"value\": \"HIGH\"}
    ],
    \"targetAgentId\": \"$AGENT1_ID\"
  }")

RULE2_ID=$(echo $RULE2 | jq -r '.data.id')
echo "Rule 2 created: $RULE2_ID"
```
Expected: HTTP 201; rule created (conflict not blocked at save time).

```bash
# Step 2 — List rules and verify hasConflict flag on both rank-10 rules
curl -s "http://localhost:3000/api/v1/assignment-rules" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | \
  jq '.data[] | select(.rank == 10) | {name, rank, hasConflict}'
```
Expected: Both rank-10 rules have `hasConflict = true`.

```bash
# Step 3 — Reorder: give RULE2 a lower rank (fires first), push RULE to rank 20
curl -s -X PUT http://localhost:3000/api/v1/assignment-rules/reorder \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "[
    {\"id\": \"$RULE2_ID\", \"rank\": 5},
    {\"id\": \"$RULE_ID\",  \"rank\": 20}
  ]" | jq '.data[] | {name, rank}'
```
Expected: HTTP 200; `RULE2_ID` now has `rank = 5`; `RULE_ID` has `rank = 20`;
no conflict flags.

```bash
# Step 4 — Submit a matching ticket; expect it to go directly to agent1 (via rule2)
# Ensure agent1 and agent2 are both AVAILABLE first
curl -s -X PUT http://localhost:3000/api/v1/agent-availability/status \
  -H "Authorization: Bearer $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"AVAILABLE"}' > /dev/null
curl -s -X PUT http://localhost:3000/api/v1/agent-availability/status \
  -H "Authorization: Bearer $AGENT2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"AVAILABLE"}' > /dev/null

TICKET5=$(curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"VPN access blocked after update\",
    \"description\": \"Cannot connect to corporate VPN since yesterday's patch.\",
    \"priority\": \"HIGH\",
    \"categoryId\": \"$CATEGORY_ID\"
  }")

TICKET5_ID=$(echo $TICKET5 | jq -r '.data.id')
sleep 1

curl -s "http://localhost:3000/api/v1/tickets/$TICKET5_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{assignedAgentId: .data.assignedAgentId, teamId: .data.teamId}'
```
Expected: `assignedAgentId = $AGENT1_ID`; `teamId = null` (rule2 targets an agent
directly, not a team).

```bash
# Step 5 — Verify activity log shows rule2 name
curl -s "http://localhost:3000/api/v1/tickets/$TICKET5_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq '.data.activityLog[] | select(.event == "AUTO_ASSIGNED") | .newValue'
```
Expected: Activity log entry mentions `"Technical High Priority Direct to Agent1"`.

**Expected outcome**: Two rules at the same rank produce a visible `hasConflict`
flag. After reordering, the lower-rank rule fires first, routing the ticket
directly to the targeted agent. The activity log confirms which rule triggered.

---

## Running the Test Suite

```bash
cd backend

# Unit tests (rules engine, availability value object, use cases)
npm run test:unit

# Integration tests (repository layer with test DB)
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test npm run test:integration

# Contract/route tests (Supertest)
npm run test:contract

# Coverage gate (must be ≥ 80%)
npm run test:coverage
```

---

## References

- Data model: [data-model.md](data-model.md)
- Research decisions: [research.md](research.md)
- Teams API: [contracts/teams.md](contracts/teams.md)
- Assignment rules + availability API: [contracts/assignment-rules.md](contracts/assignment-rules.md)
- Workload dashboard API: [contracts/workload.md](contracts/workload.md)
