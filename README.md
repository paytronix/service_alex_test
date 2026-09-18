# ShiftFlow

Employee shift scheduling platform built with TypeScript, GraphQL, React, and PostgreSQL.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: Express, Apollo Server 4, Pothos (code-first GraphQL), Prisma, PostgreSQL
- **Web**: React 18, Vite, Tailwind CSS, Apollo Client
- **Auth**: JWT access/refresh tokens with rotation, bcrypt password hashing
- **Real-time**: GraphQL Subscriptions via `graphql-ws`
- **Infrastructure**: Docker Compose, GitHub Actions CI

## Project Structure

```
├── apps/
│   ├── api/            # GraphQL API server
│   └── web/            # React SPA
├── packages/
│   ├── shared/         # Shared types, enums, constants
│   └── config/         # Shared ESLint/TSConfig/Prettier
├── docs/               # Architecture and data model docs
├── docker-compose.yml  # PostgreSQL + API + Web
└── .github/workflows/  # CI pipeline
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker and Docker Compose (for PostgreSQL)

### Local Development

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up postgres -d

# Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# Start API and Web in development mode
pnpm dev
```

- API: http://localhost:4000/graphql
- Web: http://localhost:5173

### Using Docker Compose (full stack)

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000/graphql

### Environment Variables

Copy the example env files and modify as needed:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

See `.env.example` for all available variables.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema to database (no migration) |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture overview.

## Data Model

See [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for the ER diagram, all entities, and business rules.

## Features (Epics 1-3)

- [x] Monorepo with pnpm workspaces + Turborepo
- [x] Full Prisma schema (15 entities)
- [x] GraphQL API with code-first schema (Pothos)
- [x] User registration, login, email verification, password reset
- [x] JWT access + refresh token rotation
- [x] Organization CRUD with Owner auto-assignment
- [x] RBAC (Owner, Manager, Supervisor, Employee)
- [x] Member invitation by email
- [x] Audit logging
- [x] GraphQL Subscriptions (WebSocket)
- [x] React frontend with auth pages and dashboard
- [x] Protected routes with automatic token refresh
- [x] Docker Compose (PostgreSQL + API + Web)
- [x] GitHub Actions CI (lint + typecheck + test + migrate)
- [x] Unit tests for auth, RBAC, and components

## Features (Epic 4 — Catalogs)

- [x] CRUD for `Department`, `Role`, `Skill`, `ShiftTemplate`, scoped to the organization from the auth context
- [x] Queries for all members; `create*`/`update*`/`delete*` mutations restricted to Owner/Manager and written to `AuditLog`
- [x] Validation: non-empty and per-organization unique names, hex colors, `HH:MM` times, derived `crossesMidnight`
- [x] Shared DTOs and time/color validation utilities in `packages/shared`
- [x] Catalogs UI at `/settings/catalogs` (tabs for Departments, Roles, Skills, Shift Templates) with role-gated actions
- [x] Tests: GraphQL CRUD/scoping/RBAC integration tests and component tests for the catalog sections

### GraphQL operations

| Entity | Queries | Mutations |
|---|---|---|
| Department | `departments`, `department` | `createDepartment`, `updateDepartment`, `deleteDepartment` |
| Role | `roles`, `role` | `createRole`, `updateRole`, `deleteRole` |
| Skill | `skills`, `skill` | `createSkill`, `updateSkill`, `deleteSkill` |
| ShiftTemplate | `shiftTemplates`, `shiftTemplate` | `createShiftTemplate`, `updateShiftTemplate`, `deleteShiftTemplate` |

Every operation takes `organizationId`; the caller must be a member of that organization.

## Features (Epic 5 — Employee management)

- [x] `Employee` CRUD with `Role`/`Department` links, work limits, photo URL and `EmployeeStatus` (soft dismissal via `dismissEmployee`)
- [x] `EmployeeSkill` management (assign, remove, or replace the whole set) against the Epic 4 skill catalog
- [x] Weekly `Availability` editor (`UNAVAILABLE` / `AVAILABLE` / `AVAILABLE_AFTER HH:MM`), one record per employee per weekday
- [x] Full `LeaveRequest` lifecycle: create, approve, reject, cancel — with date-range and overlap validation, reviewer metadata and `AuditLog` entries
- [x] RBAC: Owner/Manager manage employees and review leave; Supervisor reads; Employee edits only their own availability and leave
- [x] Relations (`role`, `department`, `skills`, `availability`) resolved through DataLoader to avoid N+1 queries
- [x] Employees UI at `/employees`: filterable list, employee card (Basics / Work / Limits / Skills / Availability / Requests) and a manager leave queue
- [x] Shared enums (`EmployeeStatus`, `AvailabilityType`, `LeaveType`, `LeaveStatus`) and email/phone/date validators in `packages/shared`
- [x] Tests: GraphQL integration tests for CRUD, skills, availability, leave lifecycle, scoping and RBAC; component tests for list, card, availability editor and leave panel

### GraphQL operations

| Entity | Queries | Mutations |
|---|---|---|
| Employee | `employees`, `employeeCount`, `employee`, `myEmployeeProfile` | `createEmployee`, `updateEmployee`, `dismissEmployee`, `deleteEmployee` |
| EmployeeSkill | (via `employee.skills`) | `setEmployeeSkills`, `assignSkillToEmployee`, `removeSkillFromEmployee` |
| Availability | `employeeAvailability` | `setAvailability` |
| LeaveRequest | `leaveRequests`, `leaveRequest` | `createLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest`, `cancelLeaveRequest` |

`employees` supports `search`, `departmentId`, `roleId`, `status` filters and `limit`/`offset` pagination.

## Features (Epic 6 — Shift scheduler)

- [x] Weekly draft schedules with publish/version history and assignment snapshots
- [x] Template-backed shift assignments with optional time overrides and computed effective times
- [x] Shift requirements and schedule coverage queries
- [x] Pure shared conflict validation for overlap, rest, overtime, leave, availability, role, skill and consecutive-day rules
- [x] Owner/Manager scheduling access with department-scoped Supervisor scheduling
- [x] Schedule and shift audit events plus `SCHEDULE_UPDATED` publication hooks
- [x] Reopen published schedules for revision and republish with incremented versions
- [x] Scheduler frontend at `/schedule` with calendar, week grid, employee and role views
- [x] dnd-kit assignment, move and Alt/Meta-copy interactions with conflict colours
- [x] Coverage indicators plus publish/reopen controls

### GraphQL operations

| Entity | Queries | Mutations |
|---|---|---|
| Schedule | `schedule`, `scheduleById`, `schedules`, `scheduleCoverage`, `validateAssignment` | `createDraftSchedule`, `publishSchedule`, `reopenSchedule` |
| ShiftAssignment | (via `Schedule.assignments`) | `assignShift`, `moveShift`, `copyShift`, `updateShift`, `removeShift` |
| ShiftRequirement | `shiftRequirements` | `setShiftRequirement`, `deleteShiftRequirement` |

Schedule reads and assignment writes are organization-scoped. Employees see only published
schedules and their own assignments; Supervisors can read all schedules and write shifts only
within their own department. Assignment warnings are returned to clients while validation errors
block writes. `setShiftRequirement` with `requiredCount: 0` deletes the requirement and returns
`null`.

## Features (Epic 7 — Notifications and change history)

- [x] `Notification`, `ScheduleVersion` and `ShiftAssignmentHistory` models with organization scoping and a unified `AuditLog`
- [x] In-process typed event bus (`shift.assigned`, `shift.changed`, `leaveRequest.approved`, `leaveRequest.rejected`, `schedule.published`)
- [x] `NotificationService` with recipient resolution, pluggable channels (`IN_APP`, `EMAIL`), background delivery, `FAILED` status and retries
- [x] Injectable email transport (`setEmailTransport`); the default development transport prints the message to the console (point it at Mailhog/SMTP in real environments)
- [x] Real-time in-app delivery through the `notificationReceived` `graphql-ws` subscription
- [x] `AuditService.record(actor, action, entity, metadata)` plus filtered, paginated `auditLogs` for Owner/Manager
- [x] Schedule version list, change history and version diff queries
- [x] Notification bell with unread counter, notification center at `/notifications`, Audit Log page at `/audit-log`, and a change-history panel in the scheduler

### GraphQL operations

| Entity | Queries | Mutations / Subscriptions |
|---|---|---|
| Notification | `notifications`, `notificationsCount`, `unreadNotificationsCount` | `markNotificationRead`, `markAllNotificationsRead`, `notificationReceived` (subscription) |
| AuditLog | `auditLogs`, `auditLogsCount` | written by services only |
| Schedule history | `scheduleVersions`, `scheduleChangeHistory`, `scheduleVersionDiff` | — |

Notifications are private to their recipient; `auditLogs` requires `Owner`/`Manager`, and schedule
history additionally allows `Supervisor`. Shift events are not announced for draft schedules, and
the user who performed the action is never notified about it.

### Environment variables (Epic 7)

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_WS_URL` | web | GraphQL WebSocket endpoint; derived from `VITE_API_URL` when unset |

### Seed data

`pnpm --filter @shiftflow/api db:seed` creates a demo organization with Owner/Manager/Supervisor/Employee
accounts, catalogs, employee profiles, availability, a pending leave request, demo in-app
notifications, a shift change history entry and an audit record. The demo password is
printed by the script — it is for local development only.

## License

Proprietary
