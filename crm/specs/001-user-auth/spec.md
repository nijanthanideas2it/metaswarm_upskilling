# Feature Specification: User Authentication

**Feature Branch**: `001-user-auth`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Login module with authentication — login, logout, refresh access token, forgot password, reset password; JWT, refresh tokens, bcrypt, session expiration after inactivity."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Login (Priority: P1)

A user opens the application and signs in with their registered email address and
password. On success they are granted access to the system and land on their home
screen. On failure they receive a clear but non-revealing error message. After a
threshold of repeated failures the account is temporarily locked to deter brute-force
attacks.

**Why this priority**: Without a working login flow no other part of the application
is accessible. This is the single entry gate for all four roles (Admin, Support
Manager, Support Agent, Customer).

**Independent Test**: Can be tested by creating a test user account, visiting the
login screen, entering valid credentials, and verifying the user reaches the
authenticated home screen. Invalid credentials and lockout scenarios can be tested
independently in the same session.

**Acceptance Scenarios**:

1. **Given** a registered user with valid credentials, **When** they submit their
   email and password, **Then** they are granted access and redirected to their
   home screen.
2. **Given** a registered user, **When** they submit an incorrect password,
   **Then** the system returns a generic error without revealing whether the
   email or password was wrong.
3. **Given** a user who has failed login 5 times consecutively, **When** they
   attempt to log in again, **Then** the system rejects the attempt and informs
   them the account is temporarily locked.
4. **Given** a deactivated account, **When** the user attempts to log in,
   **Then** the system denies access with a message to contact support.

---

### User Story 2 - Session Continuity Without Re-Login (Priority: P2)

An authenticated user whose short-lived access credential is about to expire can
continue working without interruption. The application silently obtains a new
access credential in the background using the longer-lived renewal credential,
so the user never sees a forced logout during an active session.

**Why this priority**: Without silent credential renewal, every user would be
forced to re-enter their password every 15 minutes. This makes the system
unusable in practice for agents handling tickets during a shift.

**Independent Test**: Can be tested by logging in, waiting for the access
credential to expire, and verifying the application continues to work without
prompting for re-login, while the user remains idle enough to trigger inactivity
logout separately.

**Acceptance Scenarios**:

1. **Given** an authenticated user with an active renewal credential, **When**
   their access credential expires, **Then** the system automatically issues a
   new access credential without requiring user interaction.
2. **Given** a renewal credential that has already been used once, **When**
   the system attempts to use it a second time, **Then** the system rejects it
   and logs the user out as a security measure.
3. **Given** a user who has been inactive for longer than the inactivity timeout,
   **When** they next interact with the application, **Then** they are redirected
   to the login screen with a session-expired message.

---

### User Story 3 - Secure Logout (Priority: P3)

A user who has finished their work session explicitly logs out. All active
credentials are immediately invalidated so no further actions can be taken using
that session, even if someone obtains the credentials afterwards.

**Why this priority**: Explicit logout and credential invalidation are core
security hygiene requirements. Agents may share workstations or access the app
on shared devices.

**Independent Test**: Can be tested by logging in, capturing the active
credentials, logging out, and then attempting to use the captured credentials
to verify they are rejected.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they click logout, **Then** they
   are immediately signed out and redirected to the login screen.
2. **Given** credentials captured before logout, **When** those credentials are
   presented to the system after logout, **Then** the system rejects them with
   an unauthorized response.
3. **Given** a user logged in on multiple devices, **When** they log out on one
   device, **Then** only that device's session is invalidated (other sessions
   remain active).

---

### User Story 4 - Forgotten Password Recovery (Priority: P4)

A user who has forgotten their password can request a recovery link sent to their
registered email address. They receive a time-limited, single-use link that takes
them to a screen where they can set a new password and regain access.

**Why this priority**: Password recovery is essential self-service that reduces
admin burden. Without it, forgotten passwords require administrator intervention
for every user.

**Independent Test**: Can be tested end-to-end by triggering a reset request for
a test account, intercepting the reset email, following the link, setting a new
password, and verifying login with the new password succeeds.

**Acceptance Scenarios**:

1. **Given** a user who has forgotten their password, **When** they enter their
   registered email on the forgot-password screen, **Then** the system sends a
   password reset email to that address within 2 minutes.
2. **Given** an email address that is not registered, **When** it is submitted on
   the forgot-password screen, **Then** the system shows the same confirmation
   message as for a valid address (no user enumeration).
3. **Given** a valid reset link, **When** the user follows it and submits a new
   password meeting complexity rules, **Then** their password is updated and
   they are redirected to the login screen.
4. **Given** a reset link that has already been used, **When** a user follows it
   again, **Then** the system rejects the request and shows an expiry message.
5. **Given** a reset link that has not been used but has been open for longer
   than 1 hour, **When** a user submits a new password, **Then** the system
   rejects the request and prompts the user to request a fresh link.
6. **Given** a user who requests multiple reset emails in rapid succession,
   **When** they receive all emails, **Then** only the most recently issued link
   is valid; all prior links are invalidated.

---

### Edge Cases

- What happens when a user attempts to set a new password identical to their
  current password during a reset?
- What happens when a user's account is deactivated while they have an active
  session — are they immediately ejected or allowed to finish their current action?
- What happens when a refresh attempt is made using a renewal credential that
  belongs to a different user's session?
- What happens when the inactivity clock should pause — e.g., a user is actively
  reading a long ticket without making any requests?
- What happens when a user submits the reset form after the link has expired but
  before the browser tab is refreshed?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to sign in using their registered email
  address and password.
- **FR-002**: System MUST issue two credentials on successful login: a
  short-lived access credential (valid for 15 minutes) and a longer-lived renewal
  credential (valid for 7 days).
- **FR-003**: System MUST allow a valid renewal credential to be exchanged for a
  new access credential without requiring the user to re-enter their password.
- **FR-004**: System MUST invalidate a renewal credential immediately after it is
  used, issuing a new one alongside the new access credential (rolling renewal).
- **FR-005**: System MUST invalidate all credentials associated with a session
  when the user explicitly logs out.
- **FR-006**: System MUST automatically terminate a session and require re-login
  after 30 minutes of user inactivity (configurable per deployment).
- **FR-007**: System MUST reject login attempts with a generic error message that
  does not reveal whether the email or password was incorrect.
- **FR-008**: System MUST temporarily lock an account for 15 minutes after 5
  consecutive failed login attempts, and inform the user of the lockout without
  revealing the remaining lockout duration.
- **FR-009**: System MUST allow users to request a password reset by submitting
  their registered email address; the system MUST respond with the same
  confirmation message regardless of whether the email exists.
- **FR-010**: System MUST send a single-use, time-limited password reset link to
  the user's registered email; the link MUST expire after 1 hour.
- **FR-011**: System MUST invalidate all previously issued reset links for an
  account when a new reset is requested.
- **FR-012**: System MUST allow users to set a new password by following a valid
  reset link; the link MUST be invalidated immediately upon successful use.
- **FR-013**: System MUST enforce password complexity: minimum 8 characters,
  containing at least one letter and one number.
- **FR-014**: System MUST reject a new password that is identical to the user's
  current password during a reset flow.
- **FR-015**: System MUST send an email notification to the user when their
  password is successfully changed.
- **FR-016**: System MUST store all passwords in a non-reversible secured form;
  plain-text or reversibly encrypted passwords MUST NOT be stored.
- **FR-017**: System MUST log all authentication events (login success, login
  failure, logout, password reset request, password change) with a timestamp and
  masked user identifier, without logging credential values.

### Key Entities

- **User**: A registered individual with an email address, a securely stored
  password, a role (Admin, Support Manager, Support Agent, or Customer), and an
  account status (active or deactivated).
- **Access Credential**: A short-lived token authorizing the bearer to perform
  actions within the system; tied to a specific user and session.
- **Renewal Credential**: A longer-lived token used exclusively to obtain new
  access credentials without re-authentication; single-use and rotated on each
  exchange.
- **Password Reset Request**: A time-limited, single-use record linking a user
  account to a pending password change; invalidated immediately on use or after
  1 hour.
- **Authentication Event Log**: An immutable record of authentication-related
  actions for audit purposes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full login flow (enter credentials → reach
  home screen) in under 30 seconds under normal network conditions.
- **SC-002**: Password reset emails are delivered to the user's inbox within
  2 minutes of submitting the reset request.
- **SC-003**: 100% of sessions are terminated and all credentials invalidated
  within 5 seconds of a user initiating logout.
- **SC-004**: Inactive sessions are automatically invalidated after the configured
  inactivity period with no user action required; the user is redirected to the
  login screen on their next interaction.
- **SC-005**: Failed login attempts with incorrect credentials return a response
  in under 2 seconds and never disclose which field (email or password) was wrong.
- **SC-006**: Account lockout activates after the 5th consecutive failed attempt
  within the same session window, with no further logins permitted during the
  lockout period.
- **SC-007**: Password reset links are rendered unusable within 1 second of first
  use; all prior links for the same account are invalidated upon a new reset request.
- **SC-008**: All authentication event logs are persisted with no data loss; 100%
  of login, logout, and password-change events appear in the audit log.

## Assumptions

- All user accounts are created by an Administrator; end-user self-registration
  is out of scope for this module.
- All four roles (Admin, Support Manager, Support Agent, Customer) share the
  same authentication flow; role-specific home screens are handled by the
  application shell, not this module.
- Multi-factor authentication (MFA) is explicitly out of scope for this module;
  all roles authenticate using email and password only.
- Inactivity is defined as the absence of any user-initiated action (navigation,
  form submission, etc.) for the configured timeout period; background polling
  by the application does not reset the inactivity clock.
- The inactivity timeout defaults to 30 minutes and is configurable per
  deployment via an administrator setting.
- Password reset links are delivered via email only; SMS or push delivery is
  out of scope for this module.
- Account lockout after failed attempts is lifted automatically after 15 minutes
  or manually by an Administrator.
- A "session" for the purpose of logout isolation means a single device/browser
  context; users may be logged in on multiple devices simultaneously, and logout
  on one device does not affect other devices.
- The system operates in a single-organization deployment; multi-tenant
  authentication is out of scope.
- Accessibility requirements (screen reader support, keyboard navigation on the
  login form) are in scope and must meet WCAG 2.1 AA standards.

## Clarifications

### Session 2026-06-16

- Q: Should MFA be required for any roles? → A: No MFA — email and password only for all roles (v1 scope).
