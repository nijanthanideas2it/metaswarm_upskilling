# Feature Specification: Ticket Assignment

**Feature Branch**: `004-ticket-assignment`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Lets create Ticket assignment module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates Support Teams for Organised Routing (Priority: P1)

An Admin creates support teams (e.g., "Technical Support", "Billing", "Enterprise
Accounts") and assigns Support Agents as members. Teams become the primary routing
targets for assignment rules, allowing tickets to be sent to the right group of
agents rather than a single person, improving resilience when individuals are
unavailable.

**Why this priority**: Teams are the foundational building block for everything
else in this module. Assignment rules, workload visibility, and availability
management all operate at the team level. Without teams, only individual-agent
routing is possible, which does not scale.

**Independent Test**: Can be validated by creating two teams with distinct names,
adding different agents to each, verifying each team's member list, and confirming
that deactivating a team removes it from the list of valid rule targets.

**Acceptance Scenarios**:

1. **Given** an Admin on the team management screen, **When** they create a team
   with a unique name, **Then** the team is created and appears in the team list.
2. **Given** an Admin viewing a team, **When** they add an active Support Agent
   as a member, **Then** the agent appears in the team's member list with their
   current availability status and open ticket count.
3. **Given** an Admin who deactivates a team, **When** a manager attempts to
   select that team as an assignment rule target, **Then** the deactivated team
   does not appear in the target options.
4. **Given** a Support Agent, **When** they belong to multiple teams, **Then**
   they are visible in the member list of each team and can receive tickets routed
   from any of those teams.

---

### User Story 2 - Manager Configures Automatic Assignment Rules (Priority: P2)

A Support Manager creates rules that automatically route incoming tickets to the
correct team or agent based on characteristics of the ticket — such as its
category, priority, or the customer's organisation. Rules are ordered by priority
so the most specific rule fires first, and they can be toggled on and off without
being deleted.

**Why this priority**: Manual assignment of every ticket is not scalable. A rules
engine that routes tickets at creation time eliminates the bottleneck of a manager
reading every ticket and dispatching it. This is the primary automation value
of the module.

**Independent Test**: Can be validated by creating a rule matching "Category =
Technical Support AND Priority = HIGH → Team: Technical Support", then submitting
a ticket with those attributes and confirming it is assigned to an available
member of that team, with the activity log recording which rule triggered the
assignment.

**Acceptance Scenarios**:

1. **Given** a Support Manager creating an assignment rule, **When** they specify
   a name, one or more match conditions (category, priority, customer organisation),
   a routing target (team or agent), and save, **Then** the rule is created and
   appears in the active rules list.
2. **Given** two active rules where Rule A has a higher priority rank than Rule B,
   **When** a ticket matches both rules, **Then** only Rule A's routing target is
   applied — Rule B is not executed.
3. **Given** a Support Manager who deactivates a rule, **When** a new ticket
   matching that rule's conditions is created, **Then** the deactivated rule is
   ignored and the ticket is processed by the next matching active rule or left
   unassigned.
4. **Given** a Support Manager reordering rules by dragging Rule B above Rule A,
   **When** a new matching ticket arrives within 10 seconds, **Then** Rule B's
   routing target is applied instead of Rule A's.

---

### User Story 3 - System Auto-Assigns an Incoming Ticket (Priority: P3)

When a customer submits a new ticket, the system evaluates all active assignment
rules in priority order and routes the ticket to the appropriate team or agent
automatically. If the rule targets a team, the system selects the available team
member with the fewest open tickets to balance workload. The assignment is logged
in the ticket's activity trail.

**Why this priority**: This is the automated outcome of US2. The rules configuration
is only valuable if the engine reliably executes it. Without this story the
assignment feature is pure manual work.

**Independent Test**: Can be validated by ensuring at least one active rule exists,
submitting a matching ticket as a test customer, and verifying within 5 seconds
that the ticket is assigned to the correct agent, with a log entry naming the rule
that triggered the assignment.

**Acceptance Scenarios**:

1. **Given** an active rule matching "Category = Billing → Team: Billing Team"
   and two available billing agents with 3 and 5 open tickets respectively,
   **When** a customer submits a billing ticket, **Then** the ticket is assigned
   to the agent with 3 open tickets within 5 seconds of creation.
2. **Given** an active rule targeting a team where all members are OFFLINE or
   BUSY, **When** a matching ticket is created, **Then** the ticket is associated
   with the team but remains without an individual assignee, and the activity log
   records the team association and the reason no agent was selected.
3. **Given** no active rules match a newly submitted ticket, **When** the rules
   engine completes evaluation, **Then** the ticket remains unassigned and the
   activity log records that no rule matched.
4. **Given** an Agent creating a ticket on behalf of a customer, **When** the
   agent does not request auto-assignment, **Then** the rules engine does not
   execute — the ticket is created unassigned.

---

### User Story 4 - Agent Sets Their Availability (Priority: P4)

A Support Agent can mark themselves as Available, Busy (temporarily unavailable),
or Offline at any time. They can also configure a recurring weekly schedule that
automatically sets their availability based on their working hours. The auto-
assignment engine uses this status to route tickets only to agents who can
actually take them.

**Why this priority**: Without availability management, the auto-assignment engine
assigns tickets to agents who are on lunch, in meetings, or off shift — tickets
sit unactionable. Availability status is essential for the engine's routing
accuracy.

**Independent Test**: Can be validated by setting a test agent to BUSY, submitting
a ticket that matches a rule targeting that agent's team, and confirming the ticket
goes to another available team member (or stays at team level if all are
unavailable). Then restoring the agent to AVAILABLE and repeating — the next
ticket should be eligible to route to them.

**Acceptance Scenarios**:

1. **Given** a Support Agent who sets their status to BUSY, **When** a new ticket
   is routed to their team, **Then** the auto-assignment engine skips them and
   selects another AVAILABLE team member.
2. **Given** a Support Agent who configures a weekly schedule (AVAILABLE Mon–Fri
   09:00–17:00), **When** the current time is outside that window, **Then** their
   effective status for the auto-assignment engine is OFFLINE regardless of their
   manually set status.
3. **Given** a Support Agent who changes their status from OFFLINE to AVAILABLE,
   **When** the next ticket is routed to their team (within 30 seconds of the
   change), **Then** they are eligible to receive the ticket.
4. **Given** a Support Manager viewing the workload dashboard, **When** an agent
   changes their availability status, **Then** the dashboard reflects the updated
   status within 30 seconds without a full page reload.

---

### User Story 5 - Manager Monitors Agent Workload to Inform Manual Decisions (Priority: P5)

A Support Manager views a real-time workload dashboard showing every agent's
current availability, their count of open and in-progress tickets, and their team
memberships. This view helps the manager spot overloaded agents, redistribute
tickets from one agent to another, and ensure the queue is progressing.

**Why this priority**: Even with auto-assignment, managers need visibility to
intervene when workloads become unbalanced. Workload visibility is the feedback
loop that makes the assignment system trustworthy.

**Independent Test**: Can be validated by seeding several agents with different
ticket counts and availability statuses, loading the workload dashboard as a
manager, and verifying that each agent's counts and statuses are accurate. Then
manually reassigning a ticket and confirming the dashboard updates within 30
seconds.

**Acceptance Scenarios**:

1. **Given** a Support Manager on the workload dashboard, **Then** they can see
   for each active agent: their name, current availability status, number of open
   tickets, number of in-progress tickets, and team memberships.
2. **Given** a Support Manager who filters the workload view by a specific team,
   **Then** only agents belonging to that team are displayed, with accurate
   ticket counts.
3. **Given** an agent's ticket count changing (a ticket is assigned or resolved),
   **When** the workload dashboard is viewed or refreshed, **Then** the updated
   count is visible within 30 seconds without requiring a full page reload.
4. **Given** a Support Manager on the workload dashboard, **When** they click on
   an agent, **Then** they are taken to that agent's assigned ticket list to
   review and optionally reassign individual tickets.

---

### Edge Cases

- What happens when a rule's target team is deactivated while the rule itself
  remains active? The rule is auto-deactivated and the manager is notified.
- What happens when two active rules share the same priority rank? The system
  applies the rule with the lower internal creation order as a tiebreaker and
  flags the conflict in the rules management screen.
- What happens when an agent's scheduled availability window begins but they
  have manually set themselves OFFLINE? The manual override takes precedence;
  scheduled availability only takes effect when the agent's manual status is
  AVAILABLE or unset.
- What happens when the only team member is unavailable and a ticket is routed
  to the team? The ticket is team-assigned but individually unassigned; the
  manager's workload dashboard shows it as needing attention.
- What happens when a ticket is manually reassigned after auto-assignment? The
  rules engine does not re-fire on subsequent manual changes; the new manual
  assignee takes ownership.
- What happens when a new agent is added to a team mid-day while unassigned
  tickets for that team exist? They become eligible for new incoming tickets
  immediately; existing unassigned team tickets are not retroactively assigned.
- What happens when an agent is removed from a team but still has tickets
  routed to them from that team? Their existing assignments are unaffected;
  they are simply no longer eligible for future routing via that team.

## Requirements *(mandatory)*

### Functional Requirements

**Team Management**

- **FR-001**: Admins MUST be able to create support teams with a unique name
  (required, max 100 chars) and an optional description (max 500 chars).
- **FR-002**: Admins and Support Managers MUST be able to add any active Support
  Agent to a team and remove them.
- **FR-003**: A Support Agent MUST be permitted to belong to multiple teams
  simultaneously; team membership is additive.
- **FR-004**: Admins MUST be able to deactivate a team; deactivated teams MUST
  NOT appear as valid assignment rule targets and MUST NOT receive new ticket
  routing.
- **FR-005**: When a team is deactivated, all active assignment rules that
  target it MUST be automatically deactivated, and the manager MUST be informed
  of the affected rules.
- **FR-006**: Admins and Support Managers MUST be able to view the member list of
  any team, displaying each member's name, current availability status, and open
  ticket count.

**Assignment Rules**

- **FR-007**: Admins and Support Managers MUST be able to create assignment rules
  with: a unique name (required), one or more match conditions, a routing target
  (a specific agent OR a team), an active/inactive status, and a priority rank.
- **FR-008**: Supported match conditions MUST include: ticket category (equals),
  ticket priority (equals or in set), and customer organisation (equals).
- **FR-009**: Multiple conditions within a single rule MUST use AND logic — all
  conditions must be satisfied for the rule to match.
- **FR-010**: Rules MUST be evaluated in ascending priority rank order; only the
  first matching rule executes per ticket.
- **FR-011**: When two rules share the same priority rank (conflict), the rule
  with the earlier creation date takes precedence and the conflict MUST be flagged
  in the rules list for admin attention.
- **FR-012**: Admins and Support Managers MUST be able to change a rule's priority
  rank; new order MUST take effect for tickets created within 10 seconds of saving.
- **FR-013**: Admins and Support Managers MUST be able to activate and deactivate
  rules individually without deleting them.
- **FR-014**: Admins MUST be able to delete a rule permanently; deletion is
  blocked while the rule is active (must be deactivated first).
- **FR-015**: Admins and Support Managers MUST be able to update a rule's
  conditions and routing target.

**Auto-Assignment Execution**

- **FR-016**: On every new ticket creation, the system MUST evaluate all active
  rules in priority order and apply the first matching rule within 5 seconds.
- **FR-017**: When a rule targets a team, the system MUST assign the ticket to
  the AVAILABLE team member with the fewest currently open tickets; ties MUST be
  broken by the agent's earliest team-join date.
- **FR-018**: When a rule targets a team and no member is AVAILABLE, the ticket
  MUST be marked as team-assigned (associated with the team) but individually
  unassigned; the activity log MUST record the reason.
- **FR-019**: When no rule matches, the ticket MUST remain unassigned; the
  activity log MUST record that the rules engine ran and found no match.
- **FR-020**: Tickets created by Agents, Managers, or Admins on behalf of a
  customer MUST NOT trigger auto-assignment unless the creator explicitly opts in.
- **FR-021**: Every auto-assignment event MUST be recorded in the ticket's
  activity log, including the rule name that triggered it and the routing target
  selected.

**Agent Availability**

- **FR-022**: Support Agents MUST be able to set their availability status to
  AVAILABLE, BUSY, or OFFLINE at any time.
- **FR-023**: The auto-assignment engine MUST treat BUSY and OFFLINE agents as
  ineligible for new ticket routing.
- **FR-024**: Support Agents MUST be able to configure a recurring weekly
  availability schedule specifying active days and start/end times in their
  local timezone.
- **FR-025**: When a current time is outside an agent's configured schedule, the
  system MUST treat the agent as OFFLINE for routing purposes, regardless of
  their manually set status.
- **FR-026**: A manually set status of OFFLINE MUST override the scheduled
  availability; the scheduled window does not automatically set an agent to
  AVAILABLE when they have manually set OFFLINE.
- **FR-027**: Availability status changes MUST be reflected in the auto-assignment
  engine within 30 seconds.

**Workload Visibility**

- **FR-028**: Admins and Support Managers MUST be able to view a workload summary
  listing all active agents with: name, current availability status, open ticket
  count, in-progress ticket count, and team memberships.
- **FR-029**: The workload view MUST support filtering by team, showing only
  members of the selected team.
- **FR-030**: The workload summary counts MUST reflect the live state of the
  system; a manual refresh or polling interval of no more than 30 seconds MUST
  keep the counts current.
- **FR-031**: Clicking an agent entry in the workload view MUST navigate to that
  agent's assigned ticket list.

### Key Entities

- **SupportTeam**: A named group of Support Agents used as a routing target.
  Has a name, description, active/inactive status, and a collection of member
  agents.
- **TeamMembership**: The relationship between a SupportTeam and a Support Agent,
  recording the join date for tiebreaker purposes.
- **AssignmentRule**: A configured routing rule with an ordered priority rank,
  one or more match conditions, a routing target (agent or team), and an
  active/inactive status.
- **AssignmentRuleCondition**: A single condition within a rule — specifies
  the field to match (category, priority, organisation) and the expected value
  or set of values.
- **AgentAvailability**: An agent's current real-time status (AVAILABLE, BUSY,
  OFFLINE) plus their optional recurring weekly schedule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Auto-assignment of a matching incoming ticket completes and the
  ticket is assigned within 5 seconds of ticket creation.
- **SC-002**: Managers can view the full workload summary for all active agents
  in under 3 seconds.
- **SC-003**: 100% of auto-assignment events — including rule-triggered
  assignments, team-only associations, and no-match outcomes — are recorded in
  the ticket's activity log with the rule name and routing target.
- **SC-004**: Availability status changes are reflected in the auto-assignment
  engine within 30 seconds; zero tickets are routed to agents marked BUSY or
  OFFLINE after the 30-second propagation window.
- **SC-005**: Rule priority reordering takes effect for all tickets created more
  than 10 seconds after the change is saved; no new tickets use the old order
  beyond that window.
- **SC-006**: Admins can create, configure, and activate a new assignment rule
  in under 3 minutes from opening the rule creation form.
- **SC-007**: When all members of a targeted team are unavailable, 0% of routed
  tickets are assigned to those unavailable agents — all such tickets remain at
  team level with no individual assignee.

## Assumptions

- Basic manual assignment (assign a ticket to a specific agent, self-assign, and
  reassign) is already handled by `003-ticket-management`; this module adds teams,
  rules-based automation, agent availability, and workload visibility on top.
- Auto-assignment executes synchronously at ticket creation time within the same
  request/response cycle for v1 (adequate for up to 500 concurrent users);
  asynchronous queue-based assignment is deferred to v2 for higher scale.
- Round-robin within a team is implemented as "fewest open tickets wins"; in case
  of tie, the agent with the earliest team-join date is selected. Pure circular
  round-robin is a v2 option.
- The rules engine evaluates rules only at ticket creation time; changes to a
  ticket's category, priority, or customer organisation after creation do not
  re-trigger the engine in v1.
- Agent availability schedules are stored in UTC; the agent configures their
  timezone preference and the system converts their scheduled hours accordingly.
- Assignment rules match on three fields only (category, priority, customer
  organisation); keyword-based or free-text matching on ticket title/description
  is out of scope for v1.
- A ticket manually reassigned by a manager or agent overrides the auto-assignment
  result permanently; the engine does not re-fire on manual changes.
- Workload counts (open and in-progress ticket counts) are sourced live from the
  Ticket module; this module does not maintain its own copy of those counts.
- The workload dashboard updates via polling (30-second interval) in v1; real-time
  push notifications are deferred to a future enhancement.
- Prerequisites: `001-user-auth`, `002-customer-management`, `003-ticket-management`.
