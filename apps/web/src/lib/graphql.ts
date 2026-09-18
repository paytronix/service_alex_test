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
  query Schedule($organizationId: String!, $weekStartDate: DateTime!) {
    schedule(organizationId: $organizationId, weekStartDate: $weekStartDate) {
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
  mutation CreateDraftSchedule($organizationId: String!, $weekStartDate: DateTime!) {
    createDraftSchedule(organizationId: $organizationId, weekStartDate: $weekStartDate) {
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
