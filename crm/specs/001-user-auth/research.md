# Research: User Authentication

**Feature**: 001-user-auth
**Date**: 2026-06-16
**Status**: Complete — all unknowns resolved

---

## Decision 1: Token Strategy (Access + Refresh)

**Decision**: Short-lived JWT access tokens (15-min TTL) combined with
server-side-stored opaque refresh tokens (7-day TTL, stored as a SHA-256
hash in PostgreSQL).

**Rationale**:
- JWTs are self-contained and verifiable without a DB call on every API
  request — critical for p95 ≤ 200 ms under load.
- Refresh tokens must be revocable (logout, password reset, security events)
  so opaque tokens backed by a DB record are required. Storing the hash (not
  the raw token) means a DB breach cannot be used to impersonate users.
- 15-min access TTL matches constitution Principle III and spec FR-002.
- 7-day refresh TTL is the industry standard for "stay logged in" UX without
  excessive re-authentication burden for agents on shift.

**Alternatives considered**:
- *Long-lived JWTs* — rejected: cannot be revoked without a token blocklist,
  which adds infrastructure complexity equivalent to a DB anyway.
- *Cookie-based sessions* — rejected: React Native mobile client requires
  Authorization header tokens; cookie management on mobile adds complexity
  and CSRF surface.
- *Redis-backed session store* — deferred to v2: adds operational dependency;
  in-memory JWT + DB refresh tokens achieve equivalent security for a
  single-server v1 deployment.

---

## Decision 2: Refresh Token Rotation

**Decision**: Rolling (one-time-use) refresh tokens. Every `/auth/refresh`
call invalidates the presented token and issues a fresh token pair
(new access token + new refresh token). The old refresh token's `revokedAt`
is set immediately before the new one is written (atomic transaction).

**Rationale**:
- Detects token reuse: if a stolen token is replayed after the legitimate
  user has already refreshed, the system sees an already-revoked token and
  can respond with a security event (force-logout all sessions for the user).
- Aligns with spec FR-003, FR-004, and OWASP Refresh Token Best Practices.

**Alternatives considered**:
- *Non-rotating refresh tokens* — rejected: no detection of theft; a leaked
  token remains valid for the full 7-day window.
- *Absolute-only expiry without rotation* — rejected: same theft window
  problem; rotation adds negligible cost (single DB transaction).

---

## Decision 3: Account Lockout Storage

**Decision**: Persist lockout state in PostgreSQL on the `User` record via
`failedLoginAttempts` (INT) and `lockedUntil` (TIMESTAMPTZ) columns.

**Rationale**:
- Single source of truth that survives server restarts and horizontal scale
  without a shared cache.
- Lockout check is a single indexed-primary-key lookup, well within the
  p95 ≤ 200 ms budget.
- Matches spec FR-008 (5 attempts, 15-min lockout) directly.

**Alternatives considered**:
- *Redis counters* — deferred: same infrastructure concern as Decision 1;
  a DB-backed approach is simpler for v1 and equally correct.
- *In-memory Map* — rejected: not durable across restarts; would silently
  reset lockouts on deploy.

---

## Decision 4: Rate Limiting

**Decision**: `express-rate-limit` with an in-memory store, applied at the
route level on `/auth/login`, `/auth/forgot-password`, and `/auth/refresh`.
Limits: 10 requests per 15-minute window per IP on login and forgot-password;
30 per minute on refresh.

**Rationale**:
- Coarse IP-level throttling is an independent defensive layer complementing
  the per-account lockout (Decision 3). Both must be present (defence in depth).
- In-memory store is adequate for a single-server v1 deployment. The
  `express-rate-limit` package supports a `store` adapter (Redis, Memcached)
  for drop-in horizontal-scale migration when needed.
- Constitution Principle III mandates rate limiting on all auth endpoints.

**Alternatives considered**:
- *Redis-backed rate limit* — deferred: same infrastructure concern; adapter
  pattern makes migration straightforward.
- *No separate IP rate limit (rely on account lockout only)* — rejected:
  account lockout is per-email; an attacker probing random accounts bypasses
  it without IP-level limiting.

---

## Decision 5: Password Hashing

**Decision**: `bcryptjs` (pure-JS, no native bindings required) with cost
factor 12 (constitution minimum).

**Rationale**:
- Constitution Principle III mandates bcrypt ≥ 12 explicitly. This closes
  the decision without debate.
- `bcryptjs` avoids native compilation complexity in CI/Docker; at cost 12
  the pure-JS performance is adequate (≈ 250 ms/hash on modern hardware,
  well within the background processing budget for login).

**Alternatives considered**:
- *Argon2id* — preferred by OWASP 2023 for new systems; deferred to v2 as
  the constitution explicitly calls out bcrypt and the acceptance criteria
  list it as a constraint.
- *Native `bcrypt` bindings* — optional upgrade if cost-12 latency becomes
  a bottleneck; identical API, drop-in swap.

---

## Decision 6: Email Delivery

**Decision**: `nodemailer` with a configurable SMTP transport (host, port,
user, pass via environment variables). The email service is abstracted behind
an `IEmailService` interface in the Domain layer so the transport can be
swapped without touching use case code.

**Rationale**:
- SMTP is the universal minimum integration point supported by every email
  provider (SendGrid, Mailgun, AWS SES, local mail server).
- Interface abstraction (Domain layer) allows swapping to a provider SDK
  without violating the Clean Architecture boundary.
- Spec SC-002 requires delivery within 2 minutes; SMTP with direct provider
  relay is fast enough.

**Alternatives considered**:
- *SendGrid/Mailgun SDK directly in use case* — rejected: violates Clean
  Architecture (infrastructure dependency in Application layer) and creates
  vendor lock-in.
- *Async queue (BullMQ/Redis)* — deferred to v2: adds infrastructure; retry
  logic on transient failures is a v2 reliability concern.

---

## Decision 7: Request Validation

**Decision**: `zod` schemas validate all incoming request bodies at the
Presentation layer (middleware) before the controller invokes a use case.

**Rationale**:
- Constitution Principle III requires all user inputs to be validated and
  sanitised at the API boundary before reaching use cases.
- Zod provides TypeScript-first schema inference, so the validated type
  flows into the controller without an extra cast.
- Zod errors map cleanly to 422 Unprocessable Entity responses with
  field-level detail objects matching the API envelope contract.

**Alternatives considered**:
- *class-validator + class-transformer* — viable but adds decorator metadata
  configuration overhead; zod is simpler and more TypeScript-native.
- *Manual validation in controllers* — rejected: verbose, error-prone, and
  harder to test in isolation.

---

## Summary: Resolved Unknowns

| Question | Resolution |
|----------|-----------|
| Access token strategy | JWT, 15-min TTL, signed HS256 or RS256 |
| Refresh token strategy | Opaque, hashed, DB-stored, 7-day TTL, rotating |
| Account lockout storage | PostgreSQL columns on User table |
| Rate limiting store | express-rate-limit in-memory (Redis adapter for v2) |
| Password hashing algorithm | bcryptjs, cost factor 12 |
| Email delivery | nodemailer SMTP, IEmailService interface |
| Request validation | zod schemas at Presentation layer |
