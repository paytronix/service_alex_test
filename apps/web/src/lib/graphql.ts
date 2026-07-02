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
