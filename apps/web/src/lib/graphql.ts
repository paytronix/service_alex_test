import { gql } from "@apollo/client";

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!, $firstName: String!, $lastName: String!) {
    register(email: $email, password: $password, firstName: $firstName, lastName: $lastName) {
      user {
        id
        email
        firstName
        lastName
        emailVerified
      }
      tokens {
        accessToken
        refreshToken
      }
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        id
        email
        firstName
        lastName
        emailVerified
      }
      tokens {
        accessToken
        refreshToken
      }
    }
  }
`;

export const REFRESH_TOKENS_MUTATION = gql`
  mutation RefreshTokens($refreshToken: String!) {
    refreshTokens(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      firstName
      lastName
      emailVerified
    }
  }
`;

export const REQUEST_PASSWORD_RESET_MUTATION = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

export const MY_ORGANIZATIONS_QUERY = gql`
  query MyOrganizations {
    myOrganizations {
      id
      name
      slug
      timezone
      role
      createdAt
    }
  }
`;

export const CREATE_ORGANIZATION_MUTATION = gql`
  mutation CreateOrganization($name: String!, $timezone: String) {
    createOrganization(name: $name, timezone: $timezone) {
      id
      name
      slug
      timezone
      createdAt
    }
  }
`;

export const INVITE_MUTATION = gql`
  mutation InviteToOrganization(
    $organizationId: String!
    $email: String!
    $role: MembershipRole
  ) {
    inviteToOrganization(organizationId: $organizationId, email: $email, role: $role) {
      id
      email
      role
      expiresAt
    }
  }
`;

export const ORGANIZATION_MEMBERS_QUERY = gql`
  query OrganizationMembers($organizationId: String!) {
    organizationMembers(organizationId: $organizationId) {
      id
      userId
      role
      userEmail
      userFirstName
      userLastName
      createdAt
    }
  }
`;

// ─── Catalogs (Epic 4) ───────────────────────────────────────

export const DEPARTMENTS_QUERY = gql`
  query Departments($organizationId: String!) {
    departments(organizationId: $organizationId) {
      id
      name
      createdAt
    }
  }
`;

export const CREATE_DEPARTMENT_MUTATION = gql`
  mutation CreateDepartment($organizationId: String!, $name: String!) {
    createDepartment(organizationId: $organizationId, name: $name) {
      id
      name
      createdAt
    }
  }
`;

export const UPDATE_DEPARTMENT_MUTATION = gql`
  mutation UpdateDepartment($organizationId: String!, $id: String!, $name: String!) {
    updateDepartment(organizationId: $organizationId, id: $id, name: $name) {
      id
      name
    }
  }
`;

export const DELETE_DEPARTMENT_MUTATION = gql`
  mutation DeleteDepartment($organizationId: String!, $id: String!) {
    deleteDepartment(organizationId: $organizationId, id: $id)
  }
`;

export const SKILLS_QUERY = gql`
  query Skills($organizationId: String!) {
    skills(organizationId: $organizationId) {
      id
      name
      createdAt
    }
  }
`;

export const CREATE_SKILL_MUTATION = gql`
  mutation CreateSkill($organizationId: String!, $name: String!) {
    createSkill(organizationId: $organizationId, name: $name) {
      id
      name
      createdAt
    }
  }
`;

export const UPDATE_SKILL_MUTATION = gql`
  mutation UpdateSkill($organizationId: String!, $id: String!, $name: String!) {
    updateSkill(organizationId: $organizationId, id: $id, name: $name) {
      id
      name
    }
  }
`;

export const DELETE_SKILL_MUTATION = gql`
  mutation DeleteSkill($organizationId: String!, $id: String!) {
    deleteSkill(organizationId: $organizationId, id: $id)
  }
`;

export const ROLES_QUERY = gql`
  query Roles($organizationId: String!) {
    roles(organizationId: $organizationId) {
      id
      name
      color
      description
      maxLoad
      hourlyRate
    }
  }
`;

export const CREATE_ROLE_MUTATION = gql`
  mutation CreateRole(
    $organizationId: String!
    $name: String!
    $color: String
    $description: String
    $maxLoad: Int
    $hourlyRate: Float
  ) {
    createRole(
      organizationId: $organizationId
      name: $name
      color: $color
      description: $description
      maxLoad: $maxLoad
      hourlyRate: $hourlyRate
    ) {
      id
      name
      color
      description
      maxLoad
      hourlyRate
    }
  }
`;

export const UPDATE_ROLE_MUTATION = gql`
  mutation UpdateRole(
    $organizationId: String!
    $id: String!
    $name: String
    $color: String
    $description: String
    $maxLoad: Int
    $hourlyRate: Float
  ) {
    updateRole(
      organizationId: $organizationId
      id: $id
      name: $name
      color: $color
      description: $description
      maxLoad: $maxLoad
      hourlyRate: $hourlyRate
    ) {
      id
      name
      color
      description
      maxLoad
      hourlyRate
    }
  }
`;

export const DELETE_ROLE_MUTATION = gql`
  mutation DeleteRole($organizationId: String!, $id: String!) {
    deleteRole(organizationId: $organizationId, id: $id)
  }
`;

export const SHIFT_TEMPLATES_QUERY = gql`
  query ShiftTemplates($organizationId: String!) {
    shiftTemplates(organizationId: $organizationId) {
      id
      name
      startTime
      endTime
      crossesMidnight
      breakMinutes
      minEmployees
      maxEmployees
      roleId
    }
  }
`;

export const CREATE_SHIFT_TEMPLATE_MUTATION = gql`
  mutation CreateShiftTemplate(
    $organizationId: String!
    $name: String!
    $startTime: String!
    $endTime: String!
    $roleId: String
    $breakMinutes: Int
    $minEmployees: Int
    $maxEmployees: Int
  ) {
    createShiftTemplate(
      organizationId: $organizationId
      name: $name
      startTime: $startTime
      endTime: $endTime
      roleId: $roleId
      breakMinutes: $breakMinutes
      minEmployees: $minEmployees
      maxEmployees: $maxEmployees
    ) {
      id
      name
      startTime
      endTime
      crossesMidnight
      breakMinutes
      minEmployees
      maxEmployees
      roleId
    }
  }
`;

export const UPDATE_SHIFT_TEMPLATE_MUTATION = gql`
  mutation UpdateShiftTemplate(
    $organizationId: String!
    $id: String!
    $name: String
    $startTime: String
    $endTime: String
    $roleId: String
    $breakMinutes: Int
    $minEmployees: Int
    $maxEmployees: Int
  ) {
    updateShiftTemplate(
      organizationId: $organizationId
      id: $id
      name: $name
      startTime: $startTime
      endTime: $endTime
      roleId: $roleId
      breakMinutes: $breakMinutes
      minEmployees: $minEmployees
      maxEmployees: $maxEmployees
    ) {
      id
      name
      startTime
      endTime
      crossesMidnight
      breakMinutes
      minEmployees
      maxEmployees
      roleId
    }
  }
`;

export const DELETE_SHIFT_TEMPLATE_MUTATION = gql`
  mutation DeleteShiftTemplate($organizationId: String!, $id: String!) {
    deleteShiftTemplate(organizationId: $organizationId, id: $id)
  }
`;

export const EMPLOYEES_QUERY = gql`
  query Employees(
    $organizationId: String!
    $departmentId: String
    $roleId: String
    $status: EmployeeStatus
    $search: String
  ) {
    employees(
      organizationId: $organizationId
      departmentId: $departmentId
      roleId: $roleId
      status: $status
      search: $search
    ) {
      id
      firstName
      lastName
      fullName
      email
      phone
      photoUrl
      status
      hireDate
      roleId
      departmentId
      role {
        id
        name
        color
      }
      department {
        id
        name
      }
    }
  }
`;

// ─── Reports (Epic 8) ───────────────────────────────────────

export const DASHBOARD_SUMMARY_QUERY = gql`
  query DashboardSummary($organizationId: String!) {
    dashboardSummary(organizationId: $organizationId) {
      date
      workingToday
      absentToday
      openRequests
      openShifts
      fillRatePercentThisWeek
      recentChanges {
        id
        changeType
        date
        scheduleId
        previousEmployeeName
        newEmployeeName
        changedByName
        changedAt
      }
    }
  }
`;

export const WORK_HOURS_REPORT_QUERY = gql`
  query WorkHoursReport(
    $organizationId: String!
    $from: String!
    $to: String!
    $granularity: ReportGranularity
    $employeeId: String
    $departmentId: String
    $roleId: String
    $includeDrafts: Boolean
  ) {
    workHoursReport(
      organizationId: $organizationId
      from: $from
      to: $to
      granularity: $granularity
      employeeId: $employeeId
      departmentId: $departmentId
      roleId: $roleId
      includeDrafts: $includeDrafts
    ) {
      from
      to
      granularity
      rows {
        employeeId
        employeeName
        departmentName
        roleName
        period
        shiftCount
        totalHours
      }
      totalHours
      totalShifts
    }
  }
`;

export const EMPLOYEE_WORKLOAD_REPORT_QUERY = gql`
  query EmployeeWorkloadReport(
    $organizationId: String!
    $from: String!
    $to: String!
    $departmentId: String
    $roleId: String
    $includeDrafts: Boolean
  ) {
    employeeWorkloadReport(
      organizationId: $organizationId
      from: $from
      to: $to
      departmentId: $departmentId
      roleId: $roleId
      includeDrafts: $includeDrafts
    ) {
      from
      to
      rows {
        employeeId
        employeeName
        departmentName
        roleName
        totalHours
        shiftCount
        weeksInPeriod
        avgWeeklyHours
        weeklyLimitHours
        overtimeHours
        utilizationPercent
        isOverloaded
        rank
      }
      totalHours
      averageHours
    }
  }
`;

export const SCHEDULE_FILL_RATE_REPORT_QUERY = gql`
  query ScheduleFillRateReport(
    $organizationId: String!
    $from: String
    $to: String
    $weekStartDate: String
    $includeDrafts: Boolean
  ) {
    scheduleFillRateReport(
      organizationId: $organizationId
      from: $from
      to: $to
      weekStartDate: $weekStartDate
      includeDrafts: $includeDrafts
    ) {
      from
      to
      requiredCount
      assignedCount
      filledCount
      openCount
      fillRatePercent
      byDate {
        key
        label
        requiredCount
        assignedCount
        filledCount
        fillRatePercent
      }
      byShift {
        key
        label
        requiredCount
        assignedCount
        filledCount
        fillRatePercent
      }
      byRole {
        key
        label
        requiredCount
        assignedCount
        filledCount
        fillRatePercent
      }
    }
  }
`;

export const EMPLOYEE_QUERY = gql`
  query Employee($organizationId: String!, $id: String!) {
    employee(organizationId: $organizationId, id: $id) {
      id
      firstName
      lastName
      fullName
      email
      phone
      photoUrl
      status
      hireDate
      maxHoursPerWeek
      maxConsecutiveShifts
      minRestHours
      roleId
      departmentId
      role {
        id
        name
        color
      }
      department {
        id
        name
      }
      skills {
        id
        skillId
        level
        skill {
          id
          name
        }
      }
      availability {
        id
        dayOfWeek
        type
        availableFrom
      }
    }
  }
`;

export const MY_EMPLOYEE_PROFILE_QUERY = gql`
  query MyEmployeeProfile($organizationId: String!) {
    myEmployeeProfile(organizationId: $organizationId) {
      id
      fullName
    }
  }
`;

export const CREATE_EMPLOYEE_MUTATION = gql`
  mutation CreateEmployee(
    $organizationId: String!
    $firstName: String!
    $lastName: String!
    $email: String!
    $phone: String
    $photoUrl: String
    $roleId: String
    $departmentId: String
    $hireDate: DateTime
    $status: EmployeeStatus
    $maxHoursPerWeek: Int
    $maxConsecutiveShifts: Int
    $minRestHours: Int
  ) {
    createEmployee(
      organizationId: $organizationId
      firstName: $firstName
      lastName: $lastName
      email: $email
      phone: $phone
      photoUrl: $photoUrl
      roleId: $roleId
      departmentId: $departmentId
      hireDate: $hireDate
      status: $status
      maxHoursPerWeek: $maxHoursPerWeek
      maxConsecutiveShifts: $maxConsecutiveShifts
      minRestHours: $minRestHours
    ) {
      id
    }
  }
`;

export const UPDATE_EMPLOYEE_MUTATION = gql`
  mutation UpdateEmployee(
    $organizationId: String!
    $id: String!
    $firstName: String
    $lastName: String
    $email: String
    $phone: String
    $photoUrl: String
    $roleId: String
    $departmentId: String
    $hireDate: DateTime
    $status: EmployeeStatus
    $maxHoursPerWeek: Int
    $maxConsecutiveShifts: Int
    $minRestHours: Int
  ) {
    updateEmployee(
      organizationId: $organizationId
      id: $id
      firstName: $firstName
      lastName: $lastName
      email: $email
      phone: $phone
      photoUrl: $photoUrl
      roleId: $roleId
      departmentId: $departmentId
      hireDate: $hireDate
      status: $status
      maxHoursPerWeek: $maxHoursPerWeek
      maxConsecutiveShifts: $maxConsecutiveShifts
      minRestHours: $minRestHours
    ) {
      id
    }
  }
`;

export const DISMISS_EMPLOYEE_MUTATION = gql`
  mutation DismissEmployee($organizationId: String!, $id: String!) {
    dismissEmployee(organizationId: $organizationId, id: $id) {
      id
      status
    }
  }
`;

export const DELETE_EMPLOYEE_MUTATION = gql`
  mutation DeleteEmployee($organizationId: String!, $id: String!) {
    deleteEmployee(organizationId: $organizationId, id: $id)
  }
`;

export const SET_EMPLOYEE_SKILLS_MUTATION = gql`
  mutation SetEmployeeSkills(
    $organizationId: String!
    $employeeId: String!
    $skillIds: [String!]!
  ) {
    setEmployeeSkills(
      organizationId: $organizationId
      employeeId: $employeeId
      skillIds: $skillIds
    ) {
      id
      skillId
    }
  }
`;

export const SET_AVAILABILITY_MUTATION = gql`
  mutation SetAvailability(
    $organizationId: String!
    $employeeId: String!
    $entries: [AvailabilityEntryInput!]!
  ) {
    setAvailability(
      organizationId: $organizationId
      employeeId: $employeeId
      entries: $entries
    ) {
      id
      dayOfWeek
      type
      availableFrom
    }
  }
`;

export const LEAVE_REQUESTS_QUERY = gql`
  query LeaveRequests($organizationId: String!, $employeeId: String, $status: LeaveStatus) {
    leaveRequests(organizationId: $organizationId, employeeId: $employeeId, status: $status) {
      id
      employeeId
      type
      status
      startDate
      endDate
      reason
      reviewedAt
    }
  }
`;

export const CREATE_LEAVE_REQUEST_MUTATION = gql`
  mutation CreateLeaveRequest(
    $organizationId: String!
    $employeeId: String!
    $type: LeaveType!
    $startDate: DateTime!
    $endDate: DateTime!
    $reason: String
  ) {
    createLeaveRequest(
      organizationId: $organizationId
      employeeId: $employeeId
      type: $type
      startDate: $startDate
      endDate: $endDate
      reason: $reason
    ) {
      id
      status
    }
  }
`;

// ─── Shift scheduler (Epic 6) ────────────────────────────────

const SCHEDULE_FIELDS = `
  id
  organizationId
  weekStartDate
  status
  version
  publishedAt
  assignments {
    id
    employeeId
    shiftTemplateId
    roleId
    date
    effectiveStartTime
    effectiveEndTime
    crossesMidnight
    durationHours
    breakMinutes
    notes
    employee {
      id
      firstName
      lastName
      roleId
      departmentId
    }
    shiftTemplate {
      id
      name
      startTime
      endTime
    }
    role {
      id
      name
      color
    }
  }
  requirements {
    id
    date
    shiftTemplateId
    roleId
    requiredCount
  }
`;

export const SCHEDULE_QUERY = gql`
  query Schedule(
    $organizationId: String!
    $weekStartDate: DateTime!
    $locationId: String
    $calendarId: String
  ) {
    schedule(
      organizationId: $organizationId
      weekStartDate: $weekStartDate
      locationId: $locationId
      calendarId: $calendarId
    ) {
      ${SCHEDULE_FIELDS}
    }
  }
`;

export const SCHEDULE_COVERAGE_QUERY = gql`
  query ScheduleCoverage($organizationId: String!, $scheduleId: String!) {
    scheduleCoverage(organizationId: $organizationId, scheduleId: $scheduleId) {
      date
      shiftTemplateId
      roleId
      requiredCount
      assignedCount
    }
  }
`;

export const CREATE_DRAFT_SCHEDULE_MUTATION = gql`
  mutation CreateDraftSchedule(
    $organizationId: String!
    $weekStartDate: DateTime!
    $locationId: String
    $calendarId: String
  ) {
    createDraftSchedule(
      organizationId: $organizationId
      weekStartDate: $weekStartDate
      locationId: $locationId
      calendarId: $calendarId
    ) {
      ${SCHEDULE_FIELDS}
    }
  }
`;

export const PUBLISH_SCHEDULE_MUTATION = gql`
  mutation PublishSchedule($organizationId: String!, $id: String!) {
    publishSchedule(organizationId: $organizationId, id: $id) {
      ${SCHEDULE_FIELDS}
    }
  }
`;

export const REOPEN_SCHEDULE_MUTATION = gql`
  mutation ReopenSchedule($organizationId: String!, $id: String!) {
    reopenSchedule(organizationId: $organizationId, id: $id) {
      ${SCHEDULE_FIELDS}
    }
  }
`;

const SHIFT_MUTATION_RESULT = `
  assignment {
    id
    employeeId
    shiftTemplateId
    roleId
    date
    effectiveStartTime
    effectiveEndTime
    crossesMidnight
    durationHours
    breakMinutes
    notes
    employee {
      id
      firstName
      lastName
      roleId
      departmentId
    }
    shiftTemplate {
      id
      name
      startTime
      endTime
    }
    role {
      id
      name
      color
    }
  }
  violations {
    code
    level
    message
  }
`;

export const ASSIGN_SHIFT_MUTATION = gql`
  mutation AssignShift(
    $organizationId: String!
    $scheduleId: String!
    $employeeId: String!
    $shiftTemplateId: String!
    $date: DateTime!
    $roleId: String
  ) {
    assignShift(
      organizationId: $organizationId
      scheduleId: $scheduleId
      employeeId: $employeeId
      shiftTemplateId: $shiftTemplateId
      date: $date
      roleId: $roleId
    ) {
      ${SHIFT_MUTATION_RESULT}
    }
  }
`;

export const MOVE_SHIFT_MUTATION = gql`
  mutation MoveShift(
    $organizationId: String!
    $id: String!
    $date: DateTime
    $employeeId: String
    $shiftTemplateId: String
  ) {
    moveShift(
      organizationId: $organizationId
      id: $id
      date: $date
      employeeId: $employeeId
      shiftTemplateId: $shiftTemplateId
    ) {
      ${SHIFT_MUTATION_RESULT}
    }
  }
`;

export const COPY_SHIFT_MUTATION = gql`
  mutation CopyShift(
    $organizationId: String!
    $id: String!
    $date: DateTime!
    $employeeId: String
  ) {
    copyShift(organizationId: $organizationId, id: $id, date: $date, employeeId: $employeeId) {
      ${SHIFT_MUTATION_RESULT}
    }
  }
`;

export const REMOVE_SHIFT_MUTATION = gql`
  mutation RemoveShift($organizationId: String!, $id: String!) {
    removeShift(organizationId: $organizationId, id: $id)
  }
`;

export const VALIDATE_ASSIGNMENT_QUERY = gql`
  query ValidateAssignment($organizationId: String!, $input: ValidateAssignmentInput!) {
    validateAssignment(organizationId: $organizationId, input: $input) {
      hasErrors
      hasWarnings
      violations {
        code
        level
        message
      }
    }
  }
`;

export const SET_SHIFT_REQUIREMENT_MUTATION = gql`
  mutation SetShiftRequirement(
    $organizationId: String!
    $scheduleId: String!
    $date: DateTime!
    $shiftTemplateId: String!
    $roleId: String!
    $requiredCount: Int!
  ) {
    setShiftRequirement(
      organizationId: $organizationId
      scheduleId: $scheduleId
      date: $date
      shiftTemplateId: $shiftTemplateId
      roleId: $roleId
      requiredCount: $requiredCount
    ) {
      id
      requiredCount
    }
  }
`;

export const APPROVE_LEAVE_REQUEST_MUTATION = gql`
  mutation ApproveLeaveRequest($organizationId: String!, $id: String!) {
    approveLeaveRequest(organizationId: $organizationId, id: $id) {
      id
      status
    }
  }
`;

export const REJECT_LEAVE_REQUEST_MUTATION = gql`
  mutation RejectLeaveRequest($organizationId: String!, $id: String!) {
    rejectLeaveRequest(organizationId: $organizationId, id: $id) {
      id
      status
    }
  }
`;

// ─── Notifications ───────────────────────────────────────────

export const NOTIFICATIONS_QUERY = gql`
  query Notifications(
    $organizationId: String!
    $read: Boolean
    $type: NotificationType
    $skip: Int
    $take: Int
  ) {
    notifications(
      organizationId: $organizationId
      read: $read
      type: $type
      skip: $skip
      take: $take
    ) {
      id
      type
      channel
      status
      title
      body
      payload
      readAt
      createdAt
    }
  }
`;

export const NOTIFICATIONS_COUNT_QUERY = gql`
  query NotificationsCount($organizationId: String!, $read: Boolean, $type: NotificationType) {
    notificationsCount(organizationId: $organizationId, read: $read, type: $type)
  }
`;

export const UNREAD_NOTIFICATIONS_COUNT_QUERY = gql`
  query UnreadNotificationsCount($organizationId: String!) {
    unreadNotificationsCount(organizationId: $organizationId)
  }
`;

export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($organizationId: String!, $id: String!) {
    markNotificationRead(organizationId: $organizationId, id: $id) {
      id
      readAt
      status
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead($organizationId: String!) {
    markAllNotificationsRead(organizationId: $organizationId)
  }
`;

export const NOTIFICATION_RECEIVED_SUBSCRIPTION = gql`
  subscription NotificationReceived($organizationId: String!) {
    notificationReceived(organizationId: $organizationId) {
      id
      type
      channel
      status
      title
      body
      payload
      readAt
      createdAt
    }
  }
`;

// ─── Audit log ───────────────────────────────────────────────

export const AUDIT_LOGS_QUERY = gql`
  query AuditLogs(
    $organizationId: String!
    $actorId: String
    $action: String
    $entity: String
    $from: DateTime
    $to: DateTime
    $skip: Int
    $take: Int
  ) {
    auditLogs(
      organizationId: $organizationId
      actorId: $actorId
      action: $action
      entity: $entity
      from: $from
      to: $to
      skip: $skip
      take: $take
    ) {
      id
      action
      entity
      entityId
      meta
      createdAt
      user {
        id
        email
        firstName
        lastName
      }
    }
  }
`;

export const AUDIT_LOGS_COUNT_QUERY = gql`
  query AuditLogsCount(
    $organizationId: String!
    $actorId: String
    $action: String
    $entity: String
    $from: DateTime
    $to: DateTime
  ) {
    auditLogsCount(
      organizationId: $organizationId
      actorId: $actorId
      action: $action
      entity: $entity
      from: $from
      to: $to
    )
  }
`;

// ─── Schedule history ────────────────────────────────────────

export const SCHEDULE_VERSIONS_QUERY = gql`
  query ScheduleVersions($organizationId: String!, $scheduleId: String!) {
    scheduleVersions(organizationId: $organizationId, scheduleId: $scheduleId) {
      id
      version
      publishedAt
      publishedBy {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

export const SCHEDULE_CHANGE_HISTORY_QUERY = gql`
  query ScheduleChangeHistory(
    $organizationId: String!
    $scheduleId: String!
    $skip: Int
    $take: Int
  ) {
    scheduleChangeHistory(
      organizationId: $organizationId
      scheduleId: $scheduleId
      skip: $skip
      take: $take
    ) {
      id
      assignmentId
      changeType
      date
      previousEmployeeId
      newEmployeeId
      changedAt
      changedBy {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

export const SCHEDULE_VERSION_DIFF_QUERY = gql`
  query ScheduleVersionDiff(
    $organizationId: String!
    $scheduleId: String!
    $versionA: Int!
    $versionB: Int!
  ) {
    scheduleVersionDiff(
      organizationId: $organizationId
      scheduleId: $scheduleId
      versionA: $versionA
      versionB: $versionB
    ) {
      assignmentId
      changeType
      date
      previousEmployeeId
      newEmployeeId
    }
  }
`;

// ─── Epic 9: locations & calendars ───────────────────────────

export const LOCATIONS_QUERY = gql`
  query Locations($organizationId: String!) {
    locations(organizationId: $organizationId) {
      id
      name
      timezone
      address
      isDefault
    }
  }
`;

export const CALENDARS_QUERY = gql`
  query Calendars($organizationId: String!, $locationId: String) {
    calendars(organizationId: $organizationId, locationId: $locationId) {
      id
      name
      color
      locationId
    }
  }
`;

export const CREATE_LOCATION_MUTATION = gql`
  mutation CreateLocation(
    $organizationId: String!
    $name: String!
    $timezone: String
    $address: String
    $isDefault: Boolean
  ) {
    createLocation(
      organizationId: $organizationId
      name: $name
      timezone: $timezone
      address: $address
      isDefault: $isDefault
    ) {
      id
      name
      timezone
      address
      isDefault
    }
  }
`;

export const CREATE_CALENDAR_MUTATION = gql`
  mutation CreateCalendar(
    $organizationId: String!
    $name: String!
    $locationId: String
    $color: String
  ) {
    createCalendar(
      organizationId: $organizationId
      name: $name
      locationId: $locationId
      color: $color
    ) {
      id
      name
      color
      locationId
    }
  }
`;

// ─── Epic 9: week templates & recurring rules ────────────────

const WEEK_TEMPLATE_FIELDS = `
  id
  name
  description
  locationId
  calendarId
  rules {
    id
    dayOfWeek
    shiftTemplateId
    roleId
    employeeId
    requiredCount
    effectiveFrom
    effectiveTo
  }
`;

export const WEEK_TEMPLATES_QUERY = gql`
  query WeekTemplates($organizationId: String!, $locationId: String) {
    weekTemplates(organizationId: $organizationId, locationId: $locationId) {
      ${WEEK_TEMPLATE_FIELDS}
    }
  }
`;

export const CREATE_WEEK_TEMPLATE_MUTATION = gql`
  mutation CreateWeekTemplate(
    $organizationId: String!
    $name: String!
    $description: String
    $locationId: String
    $calendarId: String
  ) {
    createWeekTemplate(
      organizationId: $organizationId
      name: $name
      description: $description
      locationId: $locationId
      calendarId: $calendarId
    ) {
      ${WEEK_TEMPLATE_FIELDS}
    }
  }
`;

export const DELETE_WEEK_TEMPLATE_MUTATION = gql`
  mutation DeleteWeekTemplate($organizationId: String!, $id: String!) {
    deleteWeekTemplate(organizationId: $organizationId, id: $id)
  }
`;

export const CREATE_RECURRING_RULE_MUTATION = gql`
  mutation CreateRecurringShiftRule(
    $organizationId: String!
    $weekTemplateId: String
    $dayOfWeek: Int!
    $shiftTemplateId: String!
    $roleId: String
    $employeeId: String
    $requiredCount: Int
    $effectiveFrom: DateTime
    $effectiveTo: DateTime
  ) {
    createRecurringShiftRule(
      organizationId: $organizationId
      weekTemplateId: $weekTemplateId
      dayOfWeek: $dayOfWeek
      shiftTemplateId: $shiftTemplateId
      roleId: $roleId
      employeeId: $employeeId
      requiredCount: $requiredCount
      effectiveFrom: $effectiveFrom
      effectiveTo: $effectiveTo
    ) {
      id
      dayOfWeek
      shiftTemplateId
      roleId
      employeeId
      requiredCount
    }
  }
`;

export const DELETE_RECURRING_RULE_MUTATION = gql`
  mutation DeleteRecurringShiftRule($organizationId: String!, $id: String!) {
    deleteRecurringShiftRule(organizationId: $organizationId, id: $id)
  }
`;

export const GENERATE_SCHEDULE_FROM_TEMPLATE_MUTATION = gql`
  mutation GenerateScheduleFromTemplate(
    $organizationId: String!
    $weekStartDate: DateTime!
    $weekTemplateId: String
    $locationId: String
    $calendarId: String
  ) {
    generateScheduleFromTemplate(
      organizationId: $organizationId
      weekStartDate: $weekStartDate
      weekTemplateId: $weekTemplateId
      locationId: $locationId
      calendarId: $calendarId
    ) {
      schedule {
        id
        weekStartDate
        status
      }
      createdAssignmentIds
      createdRequirementIds
      skipped {
        ruleId
        date
        reason
      }
      violations {
        code
        level
        message
      }
    }
  }
`;

export const SAVE_WEEK_AS_TEMPLATE_MUTATION = gql`
  mutation SaveWeekAsTemplate(
    $organizationId: String!
    $scheduleId: String!
    $name: String!
    $description: String
  ) {
    saveWeekAsTemplate(
      organizationId: $organizationId
      scheduleId: $scheduleId
      name: $name
      description: $description
    ) {
      ${WEEK_TEMPLATE_FIELDS}
    }
  }
`;

// ─── Epic 9: bulk operations ─────────────────────────────────

const BULK_RESULT_FIELDS = `
  operation
  successCount
  failureCount
  results {
    index
    success
    assignmentId
    message
    errors {
      code
      level
      message
    }
  }
`;

export const BULK_ASSIGN_SHIFTS_MUTATION = gql`
  mutation BulkAssignShifts($organizationId: String!, $items: [BulkAssignShiftInput!]!) {
    bulkAssignShifts(organizationId: $organizationId, items: $items) {
      ${BULK_RESULT_FIELDS}
    }
  }
`;

export const BULK_REMOVE_SHIFTS_MUTATION = gql`
  mutation BulkRemoveShifts($organizationId: String!, $assignmentIds: [String!]!) {
    bulkRemoveShifts(organizationId: $organizationId, assignmentIds: $assignmentIds) {
      ${BULK_RESULT_FIELDS}
    }
  }
`;

export const BULK_COPY_SHIFTS_MUTATION = gql`
  mutation BulkCopyShifts($organizationId: String!, $items: [BulkCopyShiftInput!]!) {
    bulkCopyShifts(organizationId: $organizationId, items: $items) {
      ${BULK_RESULT_FIELDS}
    }
  }
`;

export const BULK_MOVE_SHIFTS_MUTATION = gql`
  mutation BulkMoveShifts($organizationId: String!, $items: [BulkMoveShiftInput!]!) {
    bulkMoveShifts(organizationId: $organizationId, items: $items) {
      ${BULK_RESULT_FIELDS}
    }
  }
`;

// ─── Epic 9: shift swaps ─────────────────────────────────────

const SWAP_FIELDS = `
  id
  assignmentId
  requestedById
  targetEmployeeId
  status
  message
  createdAt
  respondedAt
  reviewedAt
  assignment {
    id
    date
    effectiveStartTime
    effectiveEndTime
  }
  requestedBy {
    id
    firstName
    lastName
  }
  targetEmployee {
    id
    firstName
    lastName
  }
`;

export const SHIFT_SWAP_REQUESTS_QUERY = gql`
  query ShiftSwapRequests($organizationId: String!, $status: ShiftSwapStatus, $employeeId: String) {
    shiftSwapRequests(
      organizationId: $organizationId
      status: $status
      employeeId: $employeeId
    ) {
      ${SWAP_FIELDS}
    }
  }
`;

export const CREATE_SHIFT_SWAP_MUTATION = gql`
  mutation CreateShiftSwapRequest(
    $organizationId: String!
    $assignmentId: String!
    $targetEmployeeId: String!
    $message: String
  ) {
    createShiftSwapRequest(
      organizationId: $organizationId
      assignmentId: $assignmentId
      targetEmployeeId: $targetEmployeeId
      message: $message
    ) {
      ${SWAP_FIELDS}
    }
  }
`;

export const ACCEPT_SHIFT_SWAP_MUTATION = gql`
  mutation AcceptShiftSwap($organizationId: String!, $id: String!) {
    acceptShiftSwap(organizationId: $organizationId, id: $id) {
      ${SWAP_FIELDS}
    }
  }
`;

export const APPROVE_SHIFT_SWAP_MUTATION = gql`
  mutation ApproveShiftSwap($organizationId: String!, $id: String!) {
    approveShiftSwap(organizationId: $organizationId, id: $id) {
      ${SWAP_FIELDS}
    }
  }
`;

export const REJECT_SHIFT_SWAP_MUTATION = gql`
  mutation RejectShiftSwap($organizationId: String!, $id: String!) {
    rejectShiftSwap(organizationId: $organizationId, id: $id) {
      ${SWAP_FIELDS}
    }
  }
`;

export const CANCEL_SHIFT_SWAP_MUTATION = gql`
  mutation CancelShiftSwap($organizationId: String!, $id: String!) {
    cancelShiftSwap(organizationId: $organizationId, id: $id) {
      ${SWAP_FIELDS}
    }
  }
`;

// ─── Epic 9: comments & attachments ──────────────────────────

export const SHIFT_COMMENTS_QUERY = gql`
  query ShiftComments($organizationId: String!, $assignmentId: String, $scheduleId: String) {
    shiftComments(
      organizationId: $organizationId
      assignmentId: $assignmentId
      scheduleId: $scheduleId
    ) {
      id
      assignmentId
      scheduleId
      authorId
      authorName
      text
      createdAt
    }
  }
`;

export const CREATE_SHIFT_COMMENT_MUTATION = gql`
  mutation CreateShiftComment(
    $organizationId: String!
    $text: String!
    $assignmentId: String
    $scheduleId: String
  ) {
    createShiftComment(
      organizationId: $organizationId
      text: $text
      assignmentId: $assignmentId
      scheduleId: $scheduleId
    ) {
      id
      authorId
      authorName
      text
      createdAt
    }
  }
`;

export const DELETE_SHIFT_COMMENT_MUTATION = gql`
  mutation DeleteShiftComment($organizationId: String!, $id: String!) {
    deleteShiftComment(organizationId: $organizationId, id: $id)
  }
`;

export const ATTACHMENTS_QUERY = gql`
  query Attachments(
    $organizationId: String!
    $entityType: AttachmentEntityType!
    $entityId: String!
  ) {
    attachments(
      organizationId: $organizationId
      entityType: $entityType
      entityId: $entityId
    ) {
      id
      fileName
      url
      mimeType
      size
      createdAt
    }
  }
`;

export const DELETE_ATTACHMENT_MUTATION = gql`
  mutation DeleteAttachment($organizationId: String!, $id: String!) {
    deleteAttachment(organizationId: $organizationId, id: $id)
  }
`;

// ─── Epic 9: realtime ────────────────────────────────────────

export const SCHEDULE_UPDATED_SUBSCRIPTION = gql`
  subscription ScheduleUpdated(
    $organizationId: String!
    $scheduleId: String
    $weekStartDate: DateTime
    $locationId: String
    $calendarId: String
  ) {
    scheduleUpdated(
      organizationId: $organizationId
      scheduleId: $scheduleId
      weekStartDate: $weekStartDate
      locationId: $locationId
      calendarId: $calendarId
    ) {
      organizationId
      scheduleId
      weekStartDate
      kind
      assignmentIds
      actorId
      version
      updatedAt
    }
  }
`;

// ─── Epic 10: time tracking ──────────────────────────────────

const TIME_ENTRY_FIELDS = `
  id
  employeeId
  shiftAssignmentId
  clockInAt
  clockOutAt
  source
  status
  note
  approvedById
  approvedAt
  minutesWorked
`;

export const TIME_ENTRIES_QUERY = gql`
  query TimeEntries(
    $organizationId: String!
    $employeeId: String
    $from: String
    $to: String
    $status: TimeEntryStatus
  ) {
    timeEntries(
      organizationId: $organizationId
      employeeId: $employeeId
      from: $from
      to: $to
      status: $status
    ) {
      ${TIME_ENTRY_FIELDS}
      employee {
        id
        fullName
      }
    }
  }
`;

export const OPEN_TIME_ENTRY_QUERY = gql`
  query OpenTimeEntry($organizationId: String!, $employeeId: String) {
    openTimeEntry(organizationId: $organizationId, employeeId: $employeeId) {
      ${TIME_ENTRY_FIELDS}
    }
  }
`;

export const TIMESHEET_QUERY = gql`
  query Timesheet(
    $organizationId: String!
    $from: String!
    $to: String!
    $employeeId: String
    $departmentId: String
    $locationId: String
  ) {
    timesheet(
      organizationId: $organizationId
      from: $from
      to: $to
      employeeId: $employeeId
      departmentId: $departmentId
      locationId: $locationId
    ) {
      from
      to
      plannedHours
      actualHours
      overtimeHours
      rows {
        employeeId
        employeeName
        date
        shiftAssignmentId
        timeEntryId
        plannedStartAt
        plannedEndAt
        plannedMinutes
        actualStartAt
        actualEndAt
        actualMinutes
        lateMinutes
        earlyLeaveMinutes
        overtimeMinutes
        status
        approved
        missing
        unplanned
      }
    }
  }
`;

export const CLOCK_IN_MUTATION = gql`
  mutation ClockIn(
    $organizationId: String!
    $employeeId: String
    $shiftAssignmentId: String
    $source: TimeEntrySource
    $note: String
  ) {
    clockIn(
      organizationId: $organizationId
      employeeId: $employeeId
      shiftAssignmentId: $shiftAssignmentId
      source: $source
      note: $note
    ) {
      ${TIME_ENTRY_FIELDS}
    }
  }
`;

export const CLOCK_OUT_MUTATION = gql`
  mutation ClockOut(
    $organizationId: String!
    $employeeId: String
    $timeEntryId: String
    $note: String
  ) {
    clockOut(
      organizationId: $organizationId
      employeeId: $employeeId
      timeEntryId: $timeEntryId
      note: $note
    ) {
      ${TIME_ENTRY_FIELDS}
    }
  }
`;

export const ADJUST_TIME_ENTRY_MUTATION = gql`
  mutation AdjustTimeEntry(
    $organizationId: String!
    $id: String!
    $clockInAt: DateTime
    $clockOutAt: DateTime
    $note: String
  ) {
    adjustTimeEntry(
      organizationId: $organizationId
      id: $id
      clockInAt: $clockInAt
      clockOutAt: $clockOutAt
      note: $note
    ) {
      ${TIME_ENTRY_FIELDS}
    }
  }
`;

export const APPROVE_TIME_ENTRY_MUTATION = gql`
  mutation ApproveTimeEntry($organizationId: String!, $id: String!) {
    approveTimeEntry(organizationId: $organizationId, id: $id) {
      ${TIME_ENTRY_FIELDS}
    }
  }
`;

// ─── Epic 10: labor cost, payroll & pay periods ──────────────

export const LABOR_COST_REPORT_QUERY = gql`
  query LaborCostReport(
    $organizationId: String!
    $from: String!
    $to: String!
    $groupBy: LaborCostGroupBy
    $departmentId: String
    $locationId: String
    $roleId: String
  ) {
    laborCostReport(
      organizationId: $organizationId
      from: $from
      to: $to
      groupBy: $groupBy
      departmentId: $departmentId
      locationId: $locationId
      roleId: $roleId
    ) {
      from
      to
      groupBy
      currency
      plannedHours
      actualHours
      overtimeHours
      plannedCost
      actualCost
      rows {
        key
        label
        plannedHours
        actualHours
        overtimeHours
        hourlyRate
        plannedCost
        actualCost
      }
    }
  }
`;

export const PAYROLL_ROWS_QUERY = gql`
  query PayrollRows(
    $organizationId: String!
    $from: String!
    $to: String!
    $departmentId: String
    $locationId: String
  ) {
    payrollRows(
      organizationId: $organizationId
      from: $from
      to: $to
      departmentId: $departmentId
      locationId: $locationId
    ) {
      employeeId
      employeeName
      departmentName
      roleName
      locationName
      hourlyRate
      plannedHours
      actualHours
      overtimeHours
      grossPay
    }
  }
`;

export const PAY_PERIODS_QUERY = gql`
  query PayPeriods($organizationId: String!) {
    payPeriods(organizationId: $organizationId) {
      id
      from
      to
      status
      lockedAt
    }
  }
`;

export const PAYROLL_EXPORT_MUTATION = gql`
  mutation PayrollExport(
    $organizationId: String!
    $payPeriodId: String
    $from: String
    $to: String
    $format: ExportFormat
  ) {
    payrollExport(
      organizationId: $organizationId
      payPeriodId: $payPeriodId
      from: $from
      to: $to
      format: $format
    ) {
      filename
      mimeType
      content
    }
  }
`;

export const OPEN_PAY_PERIOD_MUTATION = gql`
  mutation OpenPayPeriod($organizationId: String!, $from: String!, $to: String!) {
    openPayPeriod(organizationId: $organizationId, from: $from, to: $to) {
      id
      from
      to
      status
      lockedAt
    }
  }
`;

export const LOCK_PAY_PERIOD_MUTATION = gql`
  mutation LockPayPeriod($organizationId: String!, $id: String!) {
    lockPayPeriod(organizationId: $organizationId, id: $id) {
      id
      from
      to
      status
      lockedAt
    }
  }
`;

// ─── Epic 10: open shifts ────────────────────────────────────

const OPEN_SHIFT_FIELDS = `
  id
  scheduleId
  locationId
  date
  shiftTemplateId
  roleId
  requiredCount
  filledCount
  status
  note
`;

export const OPEN_SHIFTS_QUERY = gql`
  query OpenShifts(
    $organizationId: String!
    $scheduleId: String
    $roleId: String
    $locationId: String
    $status: OpenShiftStatus
    $from: String
    $to: String
  ) {
    openShifts(
      organizationId: $organizationId
      scheduleId: $scheduleId
      roleId: $roleId
      locationId: $locationId
      status: $status
      from: $from
      to: $to
    ) {
      ${OPEN_SHIFT_FIELDS}
      claims {
        id
        employeeId
        status
      }
    }
  }
`;

export const OPEN_SHIFT_CLAIMS_QUERY = gql`
  query OpenShiftClaims(
    $organizationId: String!
    $openShiftId: String
    $employeeId: String
    $status: ClaimStatus
  ) {
    openShiftClaims(
      organizationId: $organizationId
      openShiftId: $openShiftId
      employeeId: $employeeId
      status: $status
    ) {
      id
      openShiftId
      employeeId
      status
      message
      assignmentId
      reviewedAt
      createdAt
      employee {
        id
        fullName
      }
      openShift {
        ${OPEN_SHIFT_FIELDS}
      }
    }
  }
`;

export const PUBLISH_OPEN_SHIFT_MUTATION = gql`
  mutation PublishOpenShift(
    $organizationId: String!
    $scheduleId: String!
    $date: String!
    $shiftTemplateId: String!
    $roleId: String!
    $requiredCount: Int
    $locationId: String
    $note: String
  ) {
    publishOpenShift(
      organizationId: $organizationId
      scheduleId: $scheduleId
      date: $date
      shiftTemplateId: $shiftTemplateId
      roleId: $roleId
      requiredCount: $requiredCount
      locationId: $locationId
      note: $note
    ) {
      ${OPEN_SHIFT_FIELDS}
    }
  }
`;

export const GENERATE_OPEN_SHIFTS_MUTATION = gql`
  mutation GenerateOpenShifts($organizationId: String!, $scheduleId: String!) {
    generateOpenShifts(organizationId: $organizationId, scheduleId: $scheduleId) {
      ${OPEN_SHIFT_FIELDS}
    }
  }
`;

export const CANCEL_OPEN_SHIFT_MUTATION = gql`
  mutation CancelOpenShift($organizationId: String!, $id: String!) {
    cancelOpenShift(organizationId: $organizationId, id: $id) {
      ${OPEN_SHIFT_FIELDS}
    }
  }
`;

export const CLAIM_OPEN_SHIFT_MUTATION = gql`
  mutation ClaimOpenShift($organizationId: String!, $openShiftId: String!, $message: String) {
    claimOpenShift(organizationId: $organizationId, openShiftId: $openShiftId, message: $message) {
      id
      openShiftId
      employeeId
      status
    }
  }
`;

export const WITHDRAW_OPEN_SHIFT_CLAIM_MUTATION = gql`
  mutation WithdrawOpenShiftClaim($organizationId: String!, $id: String!) {
    withdrawOpenShiftClaim(organizationId: $organizationId, id: $id) {
      id
      status
    }
  }
`;

export const APPROVE_OPEN_SHIFT_CLAIM_MUTATION = gql`
  mutation ApproveOpenShiftClaim($organizationId: String!, $id: String!) {
    approveOpenShiftClaim(organizationId: $organizationId, id: $id) {
      id
      status
      assignmentId
    }
  }
`;

export const REJECT_OPEN_SHIFT_CLAIM_MUTATION = gql`
  mutation RejectOpenShiftClaim($organizationId: String!, $id: String!) {
    rejectOpenShiftClaim(organizationId: $organizationId, id: $id) {
      id
      status
    }
  }
`;

// ─── Epic 10: integrations ───────────────────────────────────

export const WEBHOOKS_QUERY = gql`
  query Webhooks($organizationId: String!) {
    webhooks(organizationId: $organizationId) {
      id
      url
      events
      description
      active
      createdAt
    }
  }
`;

export const WEBHOOK_DELIVERIES_QUERY = gql`
  query WebhookDeliveries($organizationId: String!, $webhookId: String, $take: Int) {
    webhookDeliveries(organizationId: $organizationId, webhookId: $webhookId, take: $take) {
      id
      webhookId
      event
      status
      attempts
      responseCode
      error
      nextAttemptAt
      deliveredAt
      createdAt
    }
  }
`;

export const CREATE_WEBHOOK_MUTATION = gql`
  mutation CreateWebhook(
    $organizationId: String!
    $url: String!
    $events: [String!]!
    $description: String
    $active: Boolean
  ) {
    createWebhook(
      organizationId: $organizationId
      url: $url
      events: $events
      description: $description
      active: $active
    ) {
      secret
      webhook {
        id
        url
        events
        description
        active
        createdAt
      }
    }
  }
`;

export const UPDATE_WEBHOOK_MUTATION = gql`
  mutation UpdateWebhook(
    $organizationId: String!
    $id: String!
    $url: String
    $events: [String!]
    $description: String
    $active: Boolean
  ) {
    updateWebhook(
      organizationId: $organizationId
      id: $id
      url: $url
      events: $events
      description: $description
      active: $active
    ) {
      id
      url
      events
      description
      active
    }
  }
`;

export const ROTATE_WEBHOOK_SECRET_MUTATION = gql`
  mutation RotateWebhookSecret($organizationId: String!, $id: String!) {
    rotateWebhookSecret(organizationId: $organizationId, id: $id) {
      secret
      webhook {
        id
      }
    }
  }
`;

export const DELETE_WEBHOOK_MUTATION = gql`
  mutation DeleteWebhook($organizationId: String!, $id: String!) {
    deleteWebhook(organizationId: $organizationId, id: $id)
  }
`;

export const CALENDAR_FEED_TOKENS_QUERY = gql`
  query CalendarFeedTokens($organizationId: String!, $employeeId: String) {
    calendarFeedTokens(organizationId: $organizationId, employeeId: $employeeId) {
      id
      employeeId
      scope
      token
      revokedAt
      lastUsedAt
      createdAt
    }
  }
`;

export const CALENDAR_FEED_URL_QUERY = gql`
  query CalendarFeedUrl($organizationId: String!, $token: String!) {
    calendarFeedUrl(organizationId: $organizationId, token: $token)
  }
`;

export const ISSUE_CALENDAR_FEED_TOKEN_MUTATION = gql`
  mutation IssueCalendarFeedToken(
    $organizationId: String!
    $scope: CalendarFeedScope
    $employeeId: String
  ) {
    issueCalendarFeedToken(
      organizationId: $organizationId
      scope: $scope
      employeeId: $employeeId
    ) {
      id
      employeeId
      scope
      token
      createdAt
    }
  }
`;

export const REVOKE_CALENDAR_FEED_TOKEN_MUTATION = gql`
  mutation RevokeCalendarFeedToken($organizationId: String!, $id: String!) {
    revokeCalendarFeedToken(organizationId: $organizationId, id: $id) {
      id
      revokedAt
    }
  }
`;

export const INTEGRATION_CONNECTIONS_QUERY = gql`
  query IntegrationConnections($organizationId: String!) {
    integrationConnections(organizationId: $organizationId) {
      id
      type
      active
      config
      createdAt
    }
  }
`;

export const CONNECT_INTEGRATION_MUTATION = gql`
  mutation ConnectIntegration(
    $organizationId: String!
    $type: IntegrationType!
    $config: JSON!
    $active: Boolean
  ) {
    connectIntegration(
      organizationId: $organizationId
      type: $type
      config: $config
      active: $active
    ) {
      id
      type
      active
      config
    }
  }
`;

export const DISCONNECT_INTEGRATION_MUTATION = gql`
  mutation DisconnectIntegration($organizationId: String!, $id: String!) {
    disconnectIntegration(organizationId: $organizationId, id: $id)
  }
`;

// ─── Epic 10: documents & certifications ─────────────────────

export const EMPLOYEE_DOCUMENTS_QUERY = gql`
  query EmployeeDocuments($organizationId: String!, $employeeId: String) {
    employeeDocuments(organizationId: $organizationId, employeeId: $employeeId) {
      id
      employeeId
      type
      fileName
      url
      mimeType
      size
      createdAt
    }
  }
`;

export const DELETE_EMPLOYEE_DOCUMENT_MUTATION = gql`
  mutation DeleteEmployeeDocument($organizationId: String!, $id: String!) {
    deleteEmployeeDocument(organizationId: $organizationId, id: $id)
  }
`;

export const CERTIFICATIONS_QUERY = gql`
  query Certifications(
    $organizationId: String!
    $employeeId: String
    $status: CertificationStatus
  ) {
    certifications(organizationId: $organizationId, employeeId: $employeeId, status: $status) {
      id
      employeeId
      skillId
      name
      issuedAt
      expiresAt
      status
      employee {
        id
        fullName
      }
    }
  }
`;

export const CREATE_CERTIFICATION_MUTATION = gql`
  mutation CreateCertification(
    $organizationId: String!
    $employeeId: String!
    $name: String!
    $skillId: String
    $issuedAt: String
    $expiresAt: String
  ) {
    createCertification(
      organizationId: $organizationId
      employeeId: $employeeId
      name: $name
      skillId: $skillId
      issuedAt: $issuedAt
      expiresAt: $expiresAt
    ) {
      id
      name
      issuedAt
      expiresAt
      status
    }
  }
`;

export const UPDATE_CERTIFICATION_MUTATION = gql`
  mutation UpdateCertification(
    $organizationId: String!
    $id: String!
    $name: String
    $skillId: String
    $issuedAt: String
    $expiresAt: String
  ) {
    updateCertification(
      organizationId: $organizationId
      id: $id
      name: $name
      skillId: $skillId
      issuedAt: $issuedAt
      expiresAt: $expiresAt
    ) {
      id
      name
      issuedAt
      expiresAt
      status
    }
  }
`;

export const DELETE_CERTIFICATION_MUTATION = gql`
  mutation DeleteCertification($organizationId: String!, $id: String!) {
    deleteCertification(organizationId: $organizationId, id: $id)
  }
`;

// ─── Epic 10: billing ────────────────────────────────────────

export const SUBSCRIPTION_QUERY = gql`
  query Subscription($organizationId: String!) {
    subscription(organizationId: $organizationId) {
      id
      plan
      status
      stripeCustomerId
      currentPeriodEnd
      cancelAtPeriodEnd
      employeeCount
      locationCount
      limits {
        plan
        maxEmployees
        maxLocations
        features
      }
    }
  }
`;

export const INVOICES_QUERY = gql`
  query Invoices($organizationId: String!) {
    invoices(organizationId: $organizationId) {
      id
      stripeInvoiceId
      number
      status
      amountDue
      amountPaid
      currency
      hostedInvoiceUrl
      issuedAt
    }
  }
`;

export const CREATE_CHECKOUT_SESSION_MUTATION = gql`
  mutation CreateCheckoutSession(
    $organizationId: String!
    $plan: SubscriptionPlan!
    $successUrl: String
    $cancelUrl: String
  ) {
    createCheckoutSession(
      organizationId: $organizationId
      plan: $plan
      successUrl: $successUrl
      cancelUrl: $cancelUrl
    ) {
      url
    }
  }
`;

export const CREATE_BILLING_PORTAL_SESSION_MUTATION = gql`
  mutation CreateBillingPortalSession($organizationId: String!, $returnUrl: String) {
    createBillingPortalSession(organizationId: $organizationId, returnUrl: $returnUrl) {
      url
    }
  }
`;
