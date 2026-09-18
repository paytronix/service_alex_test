# ShiftFlow Data Model

## ER Diagram

```mermaid
erDiagram
    User ||--o{ Membership : "has"
    User ||--o{ AuditLog : "performs"
    Organization ||--o{ Membership : "contains"
    Organization ||--o{ Department : "has"
    Organization ||--o{ Role : "defines"
    Organization ||--o{ Skill : "defines"
    Organization ||--o{ Employee : "employs"
    Organization ||--o{ ShiftTemplate : "uses"
    Organization ||--o{ Schedule : "plans"
    Organization ||--o{ ShiftAssignment : "contains"
    Organization ||--o{ ShiftRequirement : "defines"
    Organization ||--o{ ScheduleVersion : "versions"
    Organization ||--o{ Invitation : "sends"
    Organization ||--o{ AuditLog : "tracks"
    Organization ||--o{ Notification : "emits"
    Department ||--o{ Employee : "groups"
    Role ||--o{ Employee : "assigned to"
    Role ||--o{ ShiftTemplate : "requires"
    Employee ||--o{ EmployeeSkill : "possesses"
    Skill ||--o{ EmployeeSkill : "rated in"
    Skill }o--o{ ShiftTemplate : "required by"
    Employee ||--o{ Availability : "declares"
    Employee ||--o{ ShiftAssignment : "works"
    Employee ||--o{ LeaveRequest : "requests"
    Schedule ||--o{ ShiftAssignment : "includes"
    Schedule ||--o{ ShiftRequirement : "requires"
    Schedule ||--o{ ScheduleVersion : "history"
    ShiftTemplate ||--o{ ShiftAssignment : "uses"
    ShiftTemplate ||--o{ ShiftRequirement : "covers"
    Role ||--o{ ShiftAssignment : "fills"
    Role ||--o{ ShiftRequirement : "needs"

    User {
        uuid id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        string phone
        string avatarUrl
        boolean emailVerified
        string emailVerifyToken
        string resetPasswordToken
        datetime resetPasswordExpires
        string refreshTokenHash
        datetime createdAt
        datetime updatedAt
    }

    Organization {
        uuid id PK
        string name
        string slug UK
        string logoUrl
        string timezone
        int[] workingDays
        string shiftStartDefault
        string shiftEndDefault
        int minRestHours
        int maxWeeklyHours
        boolean notifyByEmail
        boolean notifyInApp
        datetime createdAt
        datetime updatedAt
    }

    Membership {
        uuid id PK
        uuid userId FK
        uuid organizationId FK
        enum role
        datetime createdAt
        datetime updatedAt
    }

    Invitation {
        uuid id PK
        string email
        uuid organizationId FK
        enum role
        string token UK
        boolean accepted
        datetime expiresAt
        datetime createdAt
    }

    Department {
        uuid id PK
        string name
        uuid organizationId FK
        datetime createdAt
        datetime updatedAt
    }

    Role {
        uuid id PK
        string name
        string description
        string color
        int maxLoad
        decimal hourlyRate
        uuid organizationId FK
        datetime createdAt
        datetime updatedAt
    }

    Skill {
        uuid id PK
        string name
        uuid organizationId FK
        datetime createdAt
        datetime updatedAt
    }

    Employee {
        uuid id PK
        uuid userId FK
        string firstName
        string lastName
        string email
        string phone
        string photoUrl
        datetime hireDate
        decimal hourlyRate
        enum status
        int maxHoursPerWeek
        int maxConsecutiveShifts
        int minRestHours
        uuid organizationId FK
        uuid departmentId FK
        uuid roleId FK
        datetime createdAt
        datetime updatedAt
    }

    EmployeeSkill {
        uuid id PK
        uuid employeeId FK
        uuid skillId FK
        int level
        datetime createdAt
    }

    Availability {
        uuid id PK
        uuid employeeId FK
        int dayOfWeek
        enum type
        string availableFrom
        datetime createdAt
        datetime updatedAt
    }

    ShiftTemplate {
        uuid id PK
        string name
        uuid organizationId FK
        uuid roleId FK
        string startTime "optional override"
        string endTime "optional override"
        boolean crossesMidnight
        int breakMinutes
        int minEmployees
        int maxEmployees
        string color
        datetime createdAt
        datetime updatedAt
    }

    Schedule {
        uuid id PK
        uuid organizationId FK
        date weekStartDate UK
        enum status
        int version
        datetime publishedAt
        uuid publishedById FK
        datetime createdAt
        datetime updatedAt
    }

    ShiftAssignment {
        uuid id PK
        uuid scheduleId FK
        uuid organizationId FK
        uuid employeeId FK
        uuid shiftTemplateId FK
        uuid roleId FK
        datetime date
        string startTime
        string endTime
        int breakMinutes
        enum status
        string notes
        datetime createdAt
        datetime updatedAt
    }

    ShiftRequirement {
        uuid id PK
        uuid organizationId FK
        uuid scheduleId FK
        date date
        uuid shiftTemplateId FK
        uuid roleId FK
        int requiredCount
        datetime createdAt
        datetime updatedAt
    }

    ScheduleVersion {
        uuid id PK
        uuid organizationId FK
        uuid scheduleId FK
        int version UK
        datetime publishedAt
        uuid publishedById FK
        json snapshot
    }

    LeaveRequest {
        uuid id PK
        uuid employeeId FK
        uuid organizationId FK
        enum type
        datetime startDate
        datetime endDate
        string reason
        enum status
        uuid reviewedById FK
        datetime reviewedAt
        datetime createdAt
        datetime updatedAt
    }

    Notification {
        uuid id PK
        uuid organizationId FK
        string recipientId
        string title
        string body
        string type
        datetime readAt
        datetime createdAt
    }

    AuditLog {
        uuid id PK
        uuid userId FK
        uuid organizationId FK
        string action
        string entity
        string entityId
        json meta
        datetime createdAt
    }
```

## Business Rules

1. **No overlapping shifts (`OVERLAP`, ERROR)**: Absolute employee shift intervals cannot overlap; touching endpoints are allowed.
2. **Minimum rest (`INSUFFICIENT_REST`, ERROR)**: Non-overlapping neighbouring shifts must be separated by the employee's minimum rest or the organization default.
3. **Weekly hours (`OVERTIME`, WARNING)**: Paid hours (duration less break minutes) above the employee's limit or `Organization.maxWeeklyHours` are returned as a warning and still saved.
4. **Inactive employee (`EMPLOYEE_INACTIVE`, ERROR)**: Dismissed employees cannot receive assignments.
5. **Leave (`ON_LEAVE`, ERROR)**: Approved leave windows and `VACATION`/`SICK` employee status block assignments.
6. **Role matching (`ROLE_MISMATCH`, ERROR)**: A supplied assignment role must match the employee role.
7. **Skill matching (`SKILL_MISMATCH`, ERROR)**: Required template skills must be a subset of employee skills.
8. **Availability (`UNAVAILABLE`, ERROR)**: Unavailable weekdays block assignments.
9. **Availability-after (`AVAILABLE_AFTER_CONFLICT`, WARNING)**: Assignments beginning before an `AVAILABLE_AFTER` time are saved with a warning so the UI can explain the conflict.
10. **Consecutive days (`MAX_CONSECUTIVE_SHIFTS`, WARNING)**: A run of calendar days worked above the employee limit is returned as a warning.
11. **Night shifts**: Template and assignment intervals cross midnight when `endTime <= startTime` (for example 23:00–08:00).
12. **Schedule history**: Publishing increments the schedule version and stores the serialized assignment snapshot in `ScheduleVersion`.
13. **Catalog name uniqueness**: `Department`, `Role`, `Skill`, and `ShiftTemplate` names are unique within an organization (`@@unique([name, organizationId])`) and stored trimmed.
14. **Catalog scoping and permissions**: catalog reads are scoped to the organization from the auth context and available to any member; create/update/delete are restricted to `OWNER`/`MANAGER` and recorded in `AuditLog`.
15. **Employee email uniqueness**: `Employee.email` is unique within an organization (`@@unique([email, organizationId])`) and stored normalized (trimmed, lower-cased).
16. **One availability row per day**: `Availability` has at most one record per employee per weekday (`@@unique([employeeId, dayOfWeek])`); `availableFrom` (`HH:MM`) is required for `AVAILABLE_AFTER` and cleared for the other types.
17. **Leave overlap**: A new `LeaveRequest` cannot overlap an existing `PENDING` or `APPROVED` request for the same employee, and `endDate >= startDate`.
18. **Leave review**: Only `PENDING` requests can be approved or rejected, and only by `OWNER`/`MANAGER`; the reviewer and timestamp are stored and the action written to `AuditLog`. Approving an active `VACATION`/`SICK` request sets the employee status accordingly.
19. **Employee self-service**: an `EMPLOYEE` may edit only the availability of, and create leave requests for, the employee profile linked to their own user; `OWNER`/`MANAGER` may act on any employee in the organization.
20. **Dismissal vs deletion**: `dismissEmployee` is a soft delete that sets `status = DISMISSED`; `deleteEmployee` removes the record.
21. **Draft before publish**: Schedules must be in `DRAFT` status before they can be `PUBLISHED`. Published schedules are immutable until reopened by an Owner or Manager; publishing increments `version` and stores a `ScheduleVersion` snapshot.
22. **Notification fan-out**: domain events (`shift.assigned`, `shift.changed`, `leaveRequest.approved`, `leaveRequest.rejected`, `schedule.published`) are published on an in-process event bus; subscribers create one `Notification` row per recipient and channel. Recipients must be members of the organization, the acting user is excluded, and enabled channels come from `Organization.notifyInApp`/`notifyByEmail` unless the caller passes them explicitly.
23. **Notification delivery**: rows are created `PENDING` and delivered in the background — `SENT` with `sentAt` on success, otherwise retried up to three times and stored as `FAILED` with `attempts`/`lastError`; `retryFailed` re-delivers them. Shift events are suppressed for draft schedules.
24. **Notification ownership**: a user may read and mark read only their own notifications; `markNotificationRead`/`markAllNotificationsRead` set `readAt` and `status = READ`.
25. **Shift change history**: every assignment create/move/replace/remove writes a `ShiftAssignmentHistory` row with the change type, date, previous/new employee and actor, enabling entries such as "Monday: John → Mike, changed by Manager, 14:32".
26. **History access**: `auditLogs` is restricted to `OWNER`/`MANAGER`; `scheduleVersions`, `scheduleChangeHistory` and `scheduleVersionDiff` also allow `SUPERVISOR`. `scheduleVersionDiff` compares two `ScheduleVersion` snapshots and derives `CREATED`/`MOVED`/`REPLACED`/`REMOVED` entries.
27. **Audit writes are system-only**: `AuditLog` rows are written by services (`AuditService.record`), never by client mutations.

## Epic 8 Reports and analytics

Epic 8 adds no new database tables. Report queries use the existing schedules, assignments,
requirements, employees, leave requests, and assignment-history tables. Migration
`20260101000500_report_indexes` adds these organization- and date-oriented indexes:

- `ShiftAssignment(organizationId, date)`
- `ShiftRequirement(organizationId, date)`
- `ShiftRequirement(scheduleId)`
- `Schedule(organizationId, status)`
- `LeaveRequest(organizationId, status)`
- `LeaveRequest(employeeId, startDate)`
- `Employee(organizationId, status)`
- `Employee(organizationId, departmentId)`

Reports can be exported through `GET /api/reports/export` with a JWT. The endpoint returns CSV,
Excel, or PDF attachments and requires Owner or Manager permissions; the GraphQL `exportReport`
operation is available for API clients that need base64 file contents.

## Enums

### MembershipRole
`OWNER` | `MANAGER` | `SUPERVISOR` | `EMPLOYEE`

### ScheduleStatus
`DRAFT` | `PUBLISHED` | `ARCHIVED`

### ShiftAssignmentStatus
`ASSIGNED` | `CONFIRMED` | `DECLINED` | `SWAPPED` | `NO_SHOW` | `COMPLETED`

### EmployeeStatus
`WORKING` | `VACATION` | `SICK` | `DISMISSED`

### AvailabilityType
`UNAVAILABLE` | `AVAILABLE` | `AVAILABLE_AFTER`

### LeaveType
`VACATION` | `DAY_OFF` | `SICK` | `UNPAID` | `OTHER`

### LeaveStatus
`PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`

### NotificationType
`SHIFT_ASSIGNED` | `SHIFT_CHANGED` | `REQUEST_APPROVED` | `REQUEST_REJECTED` | `SCHEDULE_PUBLISHED`

### NotificationChannel
`EMAIL` | `IN_APP`

### NotificationStatus
`PENDING` | `SENT` | `FAILED` | `READ`

### ScheduleChangeType
`CREATED` | `MOVED` | `REPLACED` | `REMOVED`

## Notification and history models

| Model | Key fields |
|---|---|
| `Notification` | `organizationId`, `recipientId` → `User`, `type`, `channel`, `status`, `title`, `body`, `payload` (JSON), `attempts`, `lastError`, `sentAt`, `readAt`, `createdAt` |
| `AuditLog` | `organizationId`, `userId` (actor), `action`, `entity`, `entityId`, `meta` (JSON), `createdAt` |
| `ScheduleVersion` | `organizationId`, `scheduleId`, `version`, `snapshot` (JSON assignments), `publishedById`, `publishedAt` |
| `ShiftAssignmentHistory` | `organizationId`, `scheduleId`, `assignmentId`, `changeType`, `date`, `previousEmployeeId`, `newEmployeeId`, `changedById`, `metadata`, `changedAt` |

### ShiftSwapStatus
`PENDING` | `ACCEPTED_BY_TARGET` | `APPROVED` | `REJECTED` | `CANCELLED`

### AttachmentEntityType
`SHIFT_ASSIGNMENT` | `SCHEDULE` | `EMPLOYEE`

## Advanced feature models (Epic 9)

| Model | Key fields |
|---|---|
| `Location` | `organizationId`, `name`, `timezone`, `address`, `isDefault` |
| `Calendar` | `organizationId`, `locationId?`, `name`, `color` |
| `WeekTemplate` | `organizationId`, `locationId?`, `calendarId?`, `name`, `description` |
| `RecurringShiftRule` | `organizationId`, `weekTemplateId?`, `dayOfWeek`, `shiftTemplateId`, `roleId?`, `employeeId?`, `requiredCount`, `effectiveFrom?`, `effectiveTo?` |
| `ShiftSwapRequest` | `organizationId`, `assignmentId`, `requestedById`, `targetEmployeeId`, `status`, `message`, `reviewedById?`, `respondedAt?`, `reviewedAt?` |
| `ShiftComment` | `organizationId`, `assignmentId?`, `scheduleId?`, `authorId`, `text` |
| `Attachment` | `organizationId`, `entityType`, `entityId`, `fileName`, `storageKey`, `url?`, `mimeType`, `size`, `uploadedById?` |

`Schedule` and `ShiftAssignment` carry optional `calendarId`; `Schedule`, `Employee` and
`ShiftRequirement` carry optional `locationId`. Organizations without explicit locations or
calendars keep working because every one of these columns is nullable.

`NotificationType` additionally includes `SWAP_REQUESTED`, `SWAP_ACCEPTED`, `SWAP_APPROVED`,
`SWAP_REJECTED` and `SHIFT_COMMENT_ADDED`.

Attachment files live outside the database under `ATTACHMENT_STORAGE_DIR`; Redis (`REDIS_URL`) is
optional and only used as the subscription PubSub transport.
