# ShiftFlow Architecture

## Overview

ShiftFlow is an employee shift scheduling platform built as a TypeScript monorepo using **pnpm workspaces** and **Turborepo** for build orchestration.

## Monorepo Structure

```
shiftflow/
├── apps/
│   ├── api/          # GraphQL API (Express + Apollo Server + Prisma)
│   └── web/          # Web client (React + Vite + Tailwind)
├── packages/
│   ├── shared/       # Shared types, enums, constants
│   └── config/       # Shared ESLint, TypeScript, Prettier configs
├── docs/             # Architecture and data model documentation
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Backend (`apps/api`)

### Layer Architecture

```
Request
  │
  ▼
┌─────────────────────┐
│   GraphQL Resolvers  │  ← Pothos schema-builder (code-first)
│   (schema/)          │     Input validation, auth scope checks
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│     Services         │  ← Business logic, orchestration
│   (services/)        │     AuthService, OrganizationService, AuditService
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Prisma ORM         │  ← Data access layer
│   (prisma/)          │     PostgreSQL, type-safe queries
└─────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| HTTP Server | Express |
| GraphQL | Apollo Server 4 (code-first via Pothos) |
| ORM | Prisma with PostgreSQL |
| Auth | JWT (access + refresh token rotation) |
| Real-time | GraphQL Subscriptions via `graphql-ws` (WebSocket) |
| Validation | Zod + Pothos Validation Plugin |
| Auth Scoping | Pothos Scope Auth Plugin |

### Authentication Flow

1. **Registration**: Creates user, hashes password (bcrypt), generates email verification token, issues JWT pair.
2. **Login**: Validates credentials, issues access token (15min) + refresh token (7d).
3. **Token Refresh**: Validates refresh token against stored hash, rotates both tokens.
4. **Password Reset**: Generates time-limited reset token (1h), validates on reset.

### RBAC

Roles are scoped per organization via `Membership`:

| Role | Permissions |
|------|-------------|
| **Owner** | Full control: manage members, roles, settings, delete org |
| **Manager** | Manage schedules, employees, invite members, view audit logs |
| **Supervisor** | View schedules, manage team, limited editing |
| **Employee** | View own schedule, manage availability, request leave |

Authorization is enforced at the resolver level using `requireRole()` middleware.

## Frontend (`apps/web`)

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build | Vite 5 |
| Styling | Tailwind CSS |
| GraphQL Client | Apollo Client |
| Routing | React Router v6 |
| State | React Context (Auth), Apollo Cache |

### Route Structure

| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Login form |
| `/register` | Public | Registration form |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Public | Password reset form |
| `/dashboard` | Protected | Organization management |

### Token Management

- Tokens stored in `localStorage`
- `AuthProvider` handles automatic refresh on app load
- Apollo link injects `Authorization: Bearer <token>` header
- Refresh token rotation on each refresh

## Infrastructure

### Docker Compose Services

| Service | Image | Port |
|---------|-------|------|
| `postgres` | PostgreSQL 16 | 5432 |
| `api` | Custom (Node.js) | 4000 |
| `web` | Custom (Nginx + SPA) | 3000 |

### CI/CD

GitHub Actions workflow:
1. Install dependencies (pnpm)
2. Generate Prisma client
3. Run migrations
4. Lint (ESLint)
5. Typecheck (TypeScript)
6. Test (Vitest)
