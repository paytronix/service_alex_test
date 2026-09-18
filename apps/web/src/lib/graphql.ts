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
