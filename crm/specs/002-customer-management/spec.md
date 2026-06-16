# Feature Specification: Customer Management

**Feature Branch**: `002-customer-management`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Next lets create the customer management module."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Onboarding a New Customer (Priority: P1)

An Admin or Support Manager creates a new customer profile in the system,
entering the customer's contact details and optionally associating them with
an existing organization. Once created, the system sends the customer an
invitation to set their password and access the portal.

**Why this priority**: Before any support ticket can be raised or assigned
to a customer, that customer must exist in the system. This is the foundational
workflow for every other customer-facing operation.

**Independent Test**: Can be validated by creating a test customer through the
management interface, verifying the profile appears in the customer list, and
confirming an invitation email is dispatched to the provided address.

**Acceptance Scenarios**:

1. **Given** an Admin on the new-customer form, **When** they submit a valid
   name, email, and optional phone and organization, **Then** the customer profile
   is created, appears in the customer list, and an invitation email is sent to
   the customer's address.
2. **Given** an Admin submitting a new customer, **When** the provided email
   already exists in the system, **Then** the system rejects the submission and
   displays a duplicate-email error without creating a partial record.
3. **Given** a Support Agent, **When** they attempt to access the
   create-customer form, **Then** the system denies access and returns a
   permission-denied response.
4. **Given** a Support Manager, **When** they create a customer and associate
   them with an organization that already has customers, **Then** the new
   customer is added to that organization and appears in the organization's
   customer list.

---

### User Story 2 - Finding and Viewing a Customer Profile (Priority: P2)

A Support Agent, Manager, or Admin searches for a customer by name or email
address to view their full profile — including contact details, associated
organization, account status, and a summary of their support ticket activity.
This typically happens during ticket handling to understand a customer's
history.

**Why this priority**: Agents spend most of their time looking up customers
while handling tickets. Fast and accurate customer lookup directly impacts
support quality and resolution speed.

**Independent Test**: Can be validated by seeding test customer data, performing
a search by name and by partial email, confirming the correct profile loads, and
verifying the ticket activity summary is displayed.

**Acceptance Scenarios**:

1. **Given** a Support Agent on the customer search screen, **When** they type
   a customer's name or partial email, **Then** a filtered list of matching
   customers appears within 2 seconds, showing name, email, organization, and
   account status.
2. **Given** a Support Agent viewing a customer profile, **Then** they can see
   the customer's full contact details, organization membership, account status,
   and a summary showing total tickets, open tickets, and the date of the most
   recent ticket.
3. **Given** a search that matches no customers, **When** the agent submits the
   query, **Then** a clear empty-state message is displayed rather than an error.
4. **Given** a Customer, **When** they navigate to their own profile page,
   **Then** they see only their own profile — not other customers' records.

---

### User Story 3 - Managing Organizations (Priority: P3)

An Admin or Support Manager creates and manages organization (company) profiles
that group multiple customers together. This allows the support team to view
all customers from a single company, track organization-level activity, and
apply consistent handling to related tickets.

**Why this priority**: Most service desk customers operate in B2B contexts
where support relationships are organized at the company level. Organization
management enables company-wide visibility and reporting that agents need
during ticket handling.

**Independent Test**: Can be validated by creating an organization, associating
multiple test customers with it, viewing the organization's customer list, and
confirming that updating the organization's details reflects immediately on
all associated customer profiles.

**Acceptance Scenarios**:

1. **Given** an Admin on the new-organization form, **When** they submit a valid
   organization name, **Then** the organization is created and appears in the
   organization list.
2. **Given** an Admin or Manager viewing an organization profile, **When** they
   associate an existing customer with the organization, **Then** the customer
   appears in that organization's member list and the customer's profile shows
   the organization name.
3. **Given** an Admin viewing an organization, **Then** they can see all
   customers belonging to that organization, the total number of open tickets
   across all members, and the date of the most recent ticket raised by any member.
4. **Given** a Support Agent, **When** they attempt to create or update an
   organization, **Then** the system denies access.

---

### User Story 4 - Customer Updates Their Own Profile (Priority: P4)

A logged-in Customer can view their own profile and update their display name,
phone number, and job title. They cannot change their email address or account
role, as those fields are controlled by Admins.

**Why this priority**: Self-service profile maintenance reduces admin overhead
and keeps contact details accurate without requiring agent intervention for
routine updates.

**Independent Test**: Can be validated by logging in as a test customer, updating
allowed fields, saving, and confirming the changes are reflected. Attempting to
submit changes to the email field or role must be rejected by the system.

**Acceptance Scenarios**:

1. **Given** a Customer on their profile page, **When** they update their display
   name, phone number, or job title and save, **Then** the updated values are
   saved and reflected immediately on screen.
2. **Given** a Customer, **When** they attempt to submit a form that includes a
   changed email address, **Then** the system ignores or rejects the email field
   change and the original email remains unchanged.
3. **Given** a Customer, **When** they navigate to another customer's profile URL,
   **Then** the system denies access and shows a not-found or forbidden response.

---

### User Story 5 - Deactivating and Reactivating a Customer Account (Priority: P5)

An Admin deactivates a customer account when that customer should no longer
have access to the system — for example, when they leave the organization or
the support relationship ends. A deactivated customer cannot log in but their
profile and ticket history remain accessible to the support team. The Admin
can reactivate the account if access needs to be restored.

**Why this priority**: Account lifecycle management is a compliance and security
requirement. Deactivated users must be locked out promptly, but their data must
be retained for audit and historical ticket context.

**Independent Test**: Can be validated by deactivating a seeded test customer,
attempting to log in as that customer (must fail), verifying their profile and
ticket history remain visible to agents, and then reactivating the account and
confirming login succeeds again.

**Acceptance Scenarios**:

1. **Given** an Admin viewing an active customer profile, **When** they click
   deactivate and confirm, **Then** the customer's status is set to Deactivated
   and the customer can no longer log in within 5 seconds of the action.
2. **Given** a deactivated customer, **When** a Support Agent views that
   customer's profile, **Then** the profile and full ticket history remain
   accessible with a visible "Deactivated" status indicator.
3. **Given** an Admin viewing a deactivated customer profile, **When** they
   click reactivate, **Then** the customer's status returns to Active and login
   is permitted again.
4. **Given** a Support Manager, **When** they attempt to deactivate a customer,
   **Then** the system denies the action — only Admins may deactivate accounts.

---

### Edge Cases

- What happens when an Admin attempts to deactivate a customer who has open
  tickets assigned to agents — are those tickets flagged or reassigned?
- What happens when two customers are submitted simultaneously with the same
  email address (race condition on uniqueness check)?
- What happens when an organization is removed — do its associated customers
  lose the organization link or is deletion blocked while members exist?
- What happens when a customer's email is changed by an Admin — does the
  change force a re-verification before taking effect?
- What happens when a search query is fewer than 2 characters — does the system
  search or require a minimum query length?
- What happens when a customer account that has never logged in is deactivated
  — does the invitation link also become invalid?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Admin and Support Manager MUST be able to create a new customer
  profile with: full name (required), email address (required, unique), phone
  number (optional), job title (optional), and organization association (optional).
- **FR-002**: System MUST reject customer creation when the provided email
  address already exists in the system and MUST display a clear duplicate-email
  error without creating a partial record.
- **FR-003**: System MUST send an invitation to set a password to the new
  customer's email address upon successful account creation.
- **FR-004**: Admin, Support Manager, and Support Agent MUST be able to search
  for customers by full name or partial email address.
- **FR-005**: Search results MUST return within 2 seconds for datasets up to
  10,000 customer records, displaying name, email, organization name, and
  account status for each result.
- **FR-006**: Admin and Support Manager MUST be able to view the full profile
  of any customer, including contact details, organization membership, account
  status, and ticket activity summary.
- **FR-007**: Support Agents MUST be able to view customer profiles in read-only
  mode; they MUST NOT be permitted to create, update, or deactivate any customer
  account.
- **FR-008**: Admin and Support Manager MUST be able to update any customer's
  full name, phone number, job title, and organization association.
- **FR-009**: Admin MUST be able to update a customer's email address;
  Support Manager and Support Agent MUST NOT be permitted to change a customer's
  email address.
- **FR-010**: Customers MUST be able to view their own profile.
- **FR-011**: Customers MUST be able to update their own display name, phone
  number, and job title; they MUST NOT be able to change their email address,
  role, or account status.
- **FR-012**: Customers MUST NOT be able to view or access any other customer's
  profile.
- **FR-013**: Admin MUST be able to deactivate an active customer account;
  deactivated customers MUST be prevented from logging in within 5 seconds of
  deactivation.
- **FR-014**: Admin MUST be able to reactivate a deactivated customer account,
  restoring the customer's ability to log in.
- **FR-015**: Support Manager MUST NOT be permitted to deactivate or reactivate
  customer accounts — these actions are restricted to Admin only.
- **FR-016**: Deactivated customer profiles and their full ticket history MUST
  remain visible to Admin, Support Manager, and Support Agent.
- **FR-017**: Admin and Support Manager MUST be able to create organization
  profiles with: name (required), email domain (optional), industry (optional),
  and a primary contact customer (optional).
- **FR-018**: Organization names MUST be unique within the system.
- **FR-019**: Admin and Support Manager MUST be able to associate a customer
  with an organization and remove that association.
- **FR-020**: A customer MUST belong to at most one organization at a time.
- **FR-021**: Admin and Support Manager MUST be able to view a list of all
  customers belonging to a specific organization.
- **FR-022**: Customer profile pages MUST display a ticket activity summary:
  total lifetime tickets, currently open tickets, and date of the most recent
  ticket (sourced from the Ticket module; read-only within this module).
- **FR-023**: System MUST maintain an audit trail of all changes to a customer
  profile, recording: the field changed, the previous value, the new value, the
  user who made the change, and the timestamp.
- **FR-024**: Customer list views MUST support pagination with a default page
  size of 20 records and a maximum of 100 records per page.
- **FR-025**: Customer list and search results MUST support filtering by account
  status (Active / Deactivated) and sorting by name, email, or creation date.

### Key Entities

- **Customer**: An individual person registered in the system with contact
  details, an account status, a role, and an optional organization association.
  Shares its identity record with the User entity from the Authentication module.
- **Organization**: A company or business entity that groups one or more
  customers. Has a name, optional email domain, optional industry, and an
  optional primary contact.
- **CustomerProfileAuditEntry**: An immutable record of a single field change
  on a customer profile, capturing the before/after values, the editor, and
  the timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin or Manager can create a complete new customer profile and
  receive confirmation of the invitation email dispatch in under 2 minutes from
  starting the form.
- **SC-002**: Customer search returns matching results in under 2 seconds for
  queries against a dataset of up to 10,000 customer records.
- **SC-003**: Customer profile pages — including the ticket activity summary —
  load and display in under 3 seconds.
- **SC-004**: 100% of customer profile field changes are captured in the audit
  trail with the editor's identity and an accurate timestamp; zero changes occur
  without an audit entry.
- **SC-005**: Deactivated customers lose the ability to log in within 5 seconds
  of an Admin confirming the deactivation action.
- **SC-006**: Role-based access controls are enforced without exception: Support
  Agents are blocked from create/update/deactivate actions 100% of the time;
  unauthorized attempts are rejected immediately.
- **SC-007**: Organization profile pages load with a full member list and ticket
  activity summary in under 3 seconds for organizations with up to 500 members.

## Assumptions

- A customer's identity record (email, password hash, role, status) is owned by
  the Authentication module; the Customer Management module extends it with
  profile data (name, phone, job title) and organizational context.
- Account creation by Admin/Manager automatically triggers an invitation email
  (via the Auth module's invitation flow); the Customer Management module
  initiates this request but does not own the email delivery logic.
- A customer belongs to at most one organization; many-to-one relationship.
  An organization can have zero or more customers.
- Deleting an organization is blocked while it still has associated customers;
  the Admin must reassign or disassociate all members before deletion is permitted.
- When a customer's email address is changed by an Admin, the change takes
  effect immediately; a re-verification email is sent to the new address, but
  the customer can continue to log in with the new email without waiting for
  verification in v1.
- Search requires a minimum of 2 characters before results are returned; queries
  shorter than 2 characters display a prompt to enter more text.
- Hard deletion of customer records is not permitted; deactivation is the only
  way to revoke a customer's access while preserving their history.
- Ticket activity summary data on customer profiles is fetched from the Ticket
  module at read time; this module does not store or cache ticket data.
- Bulk import of customers (CSV/Excel) is out of scope for v1.
- The Customer Management module is accessible only to authenticated users;
  the Authentication module (001-user-auth) is a prerequisite dependency.
