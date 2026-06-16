# Project Context (Maintained by Orchestrator)

## Tooling
- Package manager: npm
- Language: TypeScript 5 (strict mode), Node.js 20 LTS
- Test runner: Jest + Supertest (jest.config.ts, 80% coverage threshold)
- Linter: ESLint (eslint.config.mjs)
- Build: tsc (rootDir: `.`, outDir: `dist`)
- ORM: Prisma 5, PostgreSQL 16
- Framework: Express 4

## Architecture
- Pattern: Clean Architecture — domain → application → infrastructure → presentation
- No Prisma imports outside `src/infrastructure/`
- No raw SQL
- All repository interfaces defined in `src/domain/repositories/`

## Key Constraints
- bcrypt cost factor ≥ 12
- JWT access tokens: 15-min TTL (JWT_SECRET)
- Refresh tokens: 7-day TTL (REFRESH_TOKEN_SECRET), rolling rotation, stored as SHA-256 hash
- Rate limiting on all auth endpoints
- CORS allowlist only
- No PII in logs

## Completed Work Units
| WU | Title | Key Files | Status |
|----|-------|-----------|--------|
| crm-zek | Domain layer | (in progress) | IN_PROGRESS |

## Established Patterns
- (none yet — first work unit)

## Active Services
- (none yet)
