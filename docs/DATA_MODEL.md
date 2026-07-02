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
        uuid organizationId FK
        datetime createdAt
        datetime updatedAt
    }

    Skill {
        uuid id PK
        string name
        uuid organizationId FK
        datetime createdAt
    }

    Employee {
        uuid id PK
        string externalUserId
        string firstName
        string lastName
        string email
        string phone
        datetime hireDate
        decimal hourlyRate
        uuid organizationId FK
        uuid departmentId FK
        uuid roleId FK
        boolean isActive
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
        string startTime
        string endTime
        datetime createdAt
        datetime updatedAt
    }

    ShiftTemplate {
        uuid id PK
        string name
        uuid organizationId FK
        uuid roleId FK
        string startTime
        string endTime
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
        string name
        datetime startDate
        datetime endDate
        enum status
        datetime publishedAt
        datetime createdAt
        datetime updatedAt
    }

    ShiftAssignment {
        uuid id PK
        uuid scheduleId FK
        uuid employeeId FK
        datetime date
        string startTime
        string endTime
        int breakMinutes
        enum status
        string notes
        datetime createdAt
        datetime updatedAt
    }

    LeaveRequest {
        uuid id PK
        uuid employeeId FK
        datetime startDate
        datetime endDate
        string reason
        enum status
        string reviewedBy
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

1. **No overlapping shifts**: An employee cannot be assigned to two shifts that overlap in time on the same day.
2. **Weekly hour limit**: Total assigned hours per employee per week must not exceed `Organization.maxWeeklyHours` (default 40).
3. **Minimum rest between shifts**: There must be at least `Organization.minRestHours` (default 8) hours between the end of one shift and the start of the next.
4. **Respect availability**: Shifts can only be assigned during an employee's declared availability windows.
5. **Respect leave requests**: Employees with approved leave requests cannot be assigned shifts during their leave period.
6. **Role matching**: If a `ShiftTemplate` specifies a required `Role`, only employees with that role can be assigned.
7. **Skill matching**: If a `ShiftTemplate` lists required `Skills`, assigned employees must possess those skills.
8. **Draft before publish**: Schedules must be in `DRAFT` status before they can be `PUBLISHED`. Published schedules are immutable (archive and create new).

## Enums

### MembershipRole
`OWNER` | `MANAGER` | `SUPERVISOR` | `EMPLOYEE`

### ScheduleStatus
`DRAFT` | `PUBLISHED` | `ARCHIVED`

### ShiftAssignmentStatus
`ASSIGNED` | `CONFIRMED` | `DECLINED` | `SWAPPED` | `NO_SHOW` | `COMPLETED`

### LeaveRequestStatus
`PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`
