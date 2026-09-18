import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { graphql, ExecutionResult } from "graphql";
import { MembershipRole } from "@prisma/client";
import { schema } from "../src/schema";
import { prisma } from "../src/utils/prisma";
import { createLoaders } from "../src/utils/loaders";
import type { GraphQLContext } from "../src/middleware/auth";

const SUFFIX = `employee-${Date.now()}`;

const users: Record<MembershipRole, string> = {
  OWNER: "",
  MANAGER: "",
  SUPERVISOR: "",
  EMPLOYEE: "",
};

let organizationId = "";
let otherOrganizationId = "";
let roleId = "";
let departmentId = "";
let skillId = "";
let otherOrgSkillId = "";
/** Employee record linked to the EMPLOYEE user account. */
let selfEmployeeId = "";
/** Employee record belonging to somebody else. */
let colleagueEmployeeId = "";

function createContext(userId: string | null): GraphQLContext {
  return {
    user: userId ? { userId, email: `${userId}@example.com` } : null,
    prisma,
    loaders: createLoaders(),
    getMembership: async (orgId: string) =>
      userId
        ? prisma.membership.findUnique({
            where: { userId_organizationId: { userId, organizationId: orgId } },
            select: { role: true },
          })
        : null,
  };
}

async function run<T = Record<string, unknown>>(
  source: string,
  variableValues: Record<string, unknown>,
  userId: string | null,
): Promise<ExecutionResult<T>> {
  return (await graphql({
    schema,
    source,
    variableValues,
    contextValue: createContext(userId),
  })) as ExecutionResult<T>;
}

function errorMessage(result: ExecutionResult): string {
  return result.errors?.[0]?.message ?? "";
}

const CREATE_EMPLOYEE = `
  mutation (
    $organizationId: String!
    $firstName: String!
    $lastName: String!
    $email: String!
    $phone: String
    $roleId: String
    $departmentId: String
    $maxHoursPerWeek: Int
  ) {
    createEmployee(
      organizationId: $organizationId
      firstName: $firstName
      lastName: $lastName
      email: $email
      phone: $phone
      roleId: $roleId
      departmentId: $departmentId
      maxHoursPerWeek: $maxHoursPerWeek
    ) {
      id
      fullName
      email
      status
      maxHoursPerWeek
      role { id name }
      department { id name }
    }
  }
`;

const EMPLOYEES = `
  query ($organizationId: String!, $status: EmployeeStatus, $search: String, $departmentId: String) {
    employees(
      organizationId: $organizationId
      status: $status
      search: $search
      departmentId: $departmentId
    ) {
      id
      email
      status
    }
  }
`;

const SET_AVAILABILITY = `
  mutation ($organizationId: String!, $employeeId: String!, $entries: [AvailabilityEntryInput!]!) {
    setAvailability(organizationId: $organizationId, employeeId: $employeeId, entries: $entries) {
      dayOfWeek
      type
      availableFrom
    }
  }
`;

const CREATE_LEAVE_REQUEST = `
  mutation (
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
      type
    }
  }
`;

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: { name: `Org ${SUFFIX}`, slug: `org-${SUFFIX}` },
  });
  organizationId = organization.id;

  const otherOrganization = await prisma.organization.create({
    data: { name: `Other org ${SUFFIX}`, slug: `other-org-${SUFFIX}` },
  });
  otherOrganizationId = otherOrganization.id;

  for (const role of Object.keys(users) as MembershipRole[]) {
    const user = await prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${SUFFIX}@example.com`,
        passwordHash: "hash",
        firstName: role,
        lastName: "Tester",
      },
    });
    users[role] = user.id;
    await prisma.membership.create({ data: { userId: user.id, organizationId, role } });
  }

  const role = await prisma.role.create({ data: { name: `Barista ${SUFFIX}`, organizationId } });
  roleId = role.id;
  const department = await prisma.department.create({
    data: { name: `Floor ${SUFFIX}`, organizationId },
  });
  departmentId = department.id;
  const skill = await prisma.skill.create({ data: { name: `Latte ${SUFFIX}`, organizationId } });
  skillId = skill.id;
  const otherSkill = await prisma.skill.create({
    data: { name: `Other ${SUFFIX}`, organizationId: otherOrganizationId },
  });
  otherOrgSkillId = otherSkill.id;

  const self = await prisma.employee.create({
    data: {
      organizationId,
      userId: users.EMPLOYEE,
      firstName: "Self",
      lastName: "Employee",
      email: `self-${SUFFIX}@example.com`,
    },
  });
  selfEmployeeId = self.id;

  const colleague = await prisma.employee.create({
    data: {
      organizationId,
      firstName: "Other",
      lastName: "Colleague",
      email: `colleague-${SUFFIX}@example.com`,
    },
  });
  colleagueEmployeeId = colleague.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({
    where: { id: { in: [organizationId, otherOrganizationId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

describe("Employee CRUD", () => {
  it("creates an employee with role and department relations", async () => {
    const result = await run<{
      createEmployee: {
        id: string;
        fullName: string;
        role: { name: string };
        department: { name: string };
        maxHoursPerWeek: number;
      };
    }>(
      CREATE_EMPLOYEE,
      {
        organizationId,
        firstName: "Ada",
        lastName: "Lovelace",
        email: `ada-${SUFFIX}@example.com`,
        phone: "+15550001111",
        roleId,
        departmentId,
        maxHoursPerWeek: 32,
      },
      users.OWNER,
    );

    const employee = result.data!.createEmployee;
    expect(employee.fullName).toBe("Ada Lovelace");
    expect(employee.role.name).toBe(`Barista ${SUFFIX}`);
    expect(employee.department.name).toBe(`Floor ${SUFFIX}`);
    expect(employee.maxHoursPerWeek).toBe(32);
  });

  it("rejects an invalid email and a duplicate email within the organization", async () => {
    const invalid = await run(
      CREATE_EMPLOYEE,
      { organizationId, firstName: "Bad", lastName: "Email", email: "not-an-email" },
      users.MANAGER,
    );
    expect(errorMessage(invalid)).toMatch(/email/i);

    const duplicate = await run(
      CREATE_EMPLOYEE,
      {
        organizationId,
        firstName: "Dup",
        lastName: "Licate",
        email: `self-${SUFFIX}@example.com`,
      },
      users.MANAGER,
    );
    expect(errorMessage(duplicate)).toMatch(/already/i);
  });

  it("rejects a role from another organization", async () => {
    const foreignRole = await prisma.role.create({
      data: { name: `Foreign ${SUFFIX}`, organizationId: otherOrganizationId },
    });
    const result = await run(
      CREATE_EMPLOYEE,
      {
        organizationId,
        firstName: "Wrong",
        lastName: "Org",
        email: `wrong-${SUFFIX}@example.com`,
        roleId: foreignRole.id,
      },
      users.OWNER,
    );
    expect(errorMessage(result)).toMatch(/organization/i);
  });

  it("filters, searches and scopes the employee list by organization", async () => {
    const all = await run<{ employees: { id: string }[] }>(
      EMPLOYEES,
      { organizationId },
      users.SUPERVISOR,
    );
    expect(all.data!.employees.length).toBeGreaterThanOrEqual(2);

    const searched = await run<{ employees: { email: string }[] }>(
      EMPLOYEES,
      { organizationId, search: "Colleague" },
      users.SUPERVISOR,
    );
    expect(searched.data!.employees).toHaveLength(1);
    expect(searched.data!.employees[0].email).toBe(`colleague-${SUFFIX}@example.com`);

    const foreign = await run(EMPLOYEES, { organizationId: otherOrganizationId }, users.OWNER);
    expect(errorMessage(foreign)).toMatch(/member/i);
  });

  it("soft-dismisses and hard-deletes employees, writing audit records", async () => {
    const created = await prisma.employee.create({
      data: {
        organizationId,
        firstName: "Temp",
        lastName: "Worker",
        email: `temp-${SUFFIX}@example.com`,
      },
    });

    const dismissed = await run<{ dismissEmployee: { status: string } }>(
      `mutation ($organizationId: String!, $id: String!) {
        dismissEmployee(organizationId: $organizationId, id: $id) { status }
      }`,
      { organizationId, id: created.id },
      users.OWNER,
    );
    expect(dismissed.data!.dismissEmployee.status).toBe("DISMISSED");

    const deleted = await run<{ deleteEmployee: boolean }>(
      `mutation ($organizationId: String!, $id: String!) {
        deleteEmployee(organizationId: $organizationId, id: $id)
      }`,
      { organizationId, id: created.id },
      users.OWNER,
    );
    expect(deleted.data!.deleteEmployee).toBe(true);
    expect(await prisma.employee.findUnique({ where: { id: created.id } })).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { organizationId, entityId: created.id },
      select: { action: true },
    });
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["EMPLOYEE_DISMISSED", "EMPLOYEE_DELETED"]),
    );
  });
});

describe("Employee RBAC", () => {
  it("prevents employees and supervisors from creating employees", async () => {
    for (const userId of [users.EMPLOYEE, users.SUPERVISOR]) {
      const result = await run(
        CREATE_EMPLOYEE,
        {
          organizationId,
          firstName: "Nope",
          lastName: "Denied",
          email: `nope-${userId}-${SUFFIX}@example.com`,
        },
        userId,
      );
      expect(errorMessage(result)).toMatch(/permission/i);
    }
  });

  it("prevents an employee from deleting another employee", async () => {
    const result = await run(
      `mutation ($organizationId: String!, $id: String!) {
        deleteEmployee(organizationId: $organizationId, id: $id)
      }`,
      { organizationId, id: colleagueEmployeeId },
      users.EMPLOYEE,
    );
    expect(errorMessage(result)).toMatch(/permission/i);
  });

  it("requires authentication", async () => {
    const result = await run(EMPLOYEES, { organizationId }, null);
    expect(errorMessage(result)).toMatch(/not authorized|authentication/i);
  });
});

describe("Employee skills", () => {
  it("assigns, replaces and removes skills", async () => {
    const assigned = await run<{ assignSkillToEmployee: { skill: { id: string }; level: number } }>(
      `mutation ($organizationId: String!, $employeeId: String!, $skillId: String!, $level: Int) {
        assignSkillToEmployee(
          organizationId: $organizationId
          employeeId: $employeeId
          skillId: $skillId
          level: $level
        ) { level skill { id } }
      }`,
      { organizationId, employeeId: colleagueEmployeeId, skillId, level: 3 },
      users.MANAGER,
    );
    expect(assigned.data!.assignSkillToEmployee.level).toBe(3);
    expect(assigned.data!.assignSkillToEmployee.skill.id).toBe(skillId);

    const replaced = await run<{ setEmployeeSkills: { skillId: string }[] }>(
      `mutation ($organizationId: String!, $employeeId: String!, $skillIds: [String!]!) {
        setEmployeeSkills(
          organizationId: $organizationId
          employeeId: $employeeId
          skillIds: $skillIds
        ) { skillId }
      }`,
      { organizationId, employeeId: colleagueEmployeeId, skillIds: [skillId] },
      users.MANAGER,
    );
    expect(replaced.data!.setEmployeeSkills).toEqual([{ skillId }]);

    const removed = await run<{ removeSkillFromEmployee: boolean }>(
      `mutation ($organizationId: String!, $employeeId: String!, $skillId: String!) {
        removeSkillFromEmployee(
          organizationId: $organizationId
          employeeId: $employeeId
          skillId: $skillId
        )
      }`,
      { organizationId, employeeId: colleagueEmployeeId, skillId },
      users.MANAGER,
    );
    expect(removed.data!.removeSkillFromEmployee).toBe(true);
  });

  it("rejects a skill from another organization", async () => {
    const result = await run(
      `mutation ($organizationId: String!, $employeeId: String!, $skillId: String!) {
        assignSkillToEmployee(
          organizationId: $organizationId
          employeeId: $employeeId
          skillId: $skillId
        ) { id }
      }`,
      { organizationId, employeeId: colleagueEmployeeId, skillId: otherOrgSkillId },
      users.MANAGER,
    );
    expect(errorMessage(result)).toMatch(/organization/i);
  });

  it("prevents employees from managing skills", async () => {
    const result = await run(
      `mutation ($organizationId: String!, $employeeId: String!, $skillId: String!) {
        assignSkillToEmployee(
          organizationId: $organizationId
          employeeId: $employeeId
          skillId: $skillId
        ) { id }
      }`,
      { organizationId, employeeId: selfEmployeeId, skillId },
      users.EMPLOYEE,
    );
    expect(errorMessage(result)).toMatch(/permission/i);
  });
});

describe("Availability", () => {
  it("lets an employee set their own weekly availability", async () => {
    const result = await run<{
      setAvailability: { dayOfWeek: number; type: string; availableFrom: string | null }[];
    }>(
      SET_AVAILABILITY,
      {
        organizationId,
        employeeId: selfEmployeeId,
        entries: [
          { dayOfWeek: 1, type: "AVAILABLE" },
          { dayOfWeek: 2, type: "AVAILABLE_AFTER", availableFrom: "14:30" },
          { dayOfWeek: 3, type: "UNAVAILABLE", availableFrom: "10:00" },
        ],
      },
      users.EMPLOYEE,
    );

    expect(result.data!.setAvailability).toEqual([
      { dayOfWeek: 1, type: "AVAILABLE", availableFrom: null },
      { dayOfWeek: 2, type: "AVAILABLE_AFTER", availableFrom: "14:30" },
      { dayOfWeek: 3, type: "UNAVAILABLE", availableFrom: null },
    ]);
  });

  it("requires a time for AVAILABLE_AFTER and a valid day of week", async () => {
    const missingTime = await run(
      SET_AVAILABILITY,
      {
        organizationId,
        employeeId: selfEmployeeId,
        entries: [{ dayOfWeek: 1, type: "AVAILABLE_AFTER" }],
      },
      users.EMPLOYEE,
    );
    expect(errorMessage(missingTime)).toMatch(/availableFrom is required/i);

    const badDay = await run(
      SET_AVAILABILITY,
      {
        organizationId,
        employeeId: selfEmployeeId,
        entries: [{ dayOfWeek: 9, type: "AVAILABLE" }],
      },
      users.EMPLOYEE,
    );
    expect(errorMessage(badDay)).toMatch(/day/i);
  });

  it("prevents an employee from editing somebody else's availability", async () => {
    const result = await run(
      SET_AVAILABILITY,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        entries: [{ dayOfWeek: 1, type: "AVAILABLE" }],
      },
      users.EMPLOYEE,
    );
    expect(errorMessage(result)).toMatch(/Owners and Managers/i);
  });

  it("allows a manager to set availability for anybody and read it back", async () => {
    await run(
      SET_AVAILABILITY,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        entries: [{ dayOfWeek: 5, type: "AVAILABLE" }],
      },
      users.MANAGER,
    );

    const read = await run<{ employeeAvailability: { dayOfWeek: number }[] }>(
      `query ($organizationId: String!, $employeeId: String!) {
        employeeAvailability(organizationId: $organizationId, employeeId: $employeeId) {
          dayOfWeek
        }
      }`,
      { organizationId, employeeId: colleagueEmployeeId },
      users.SUPERVISOR,
    );
    expect(read.data!.employeeAvailability).toEqual([{ dayOfWeek: 5 }]);
  });
});

describe("Leave requests", () => {
  it("runs the full create → approve lifecycle and updates employee status", async () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    const end = new Date();
    end.setDate(end.getDate() + 5);

    const created = await run<{ createLeaveRequest: { id: string; status: string } }>(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: selfEmployeeId,
        type: "VACATION",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        reason: "Holiday",
      },
      users.EMPLOYEE,
    );
    const leaveId = created.data!.createLeaveRequest.id;
    expect(created.data!.createLeaveRequest.status).toBe("PENDING");

    const approved = await run<{
      approveLeaveRequest: { status: string; reviewedById: string; reviewedAt: string };
    }>(
      `mutation ($organizationId: String!, $id: String!) {
        approveLeaveRequest(organizationId: $organizationId, id: $id) {
          status
          reviewedById
          reviewedAt
        }
      }`,
      { organizationId, id: leaveId },
      users.MANAGER,
    );
    expect(approved.data!.approveLeaveRequest.status).toBe("APPROVED");
    expect(approved.data!.approveLeaveRequest.reviewedById).toBe(users.MANAGER);

    const employee = await prisma.employee.findUnique({ where: { id: selfEmployeeId } });
    expect(employee!.status).toBe("VACATION");

    const audits = await prisma.auditLog.findMany({
      where: { organizationId, entityId: leaveId },
      select: { action: true },
    });
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["LEAVE_REQUEST_CREATED", "LEAVE_REQUEST_APPROVED"]),
    );
  });

  it("rejects a pending request and refuses to review it twice", async () => {
    const created = await run<{ createLeaveRequest: { id: string } }>(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        type: "DAY_OFF",
        startDate: "2030-01-10T00:00:00.000Z",
        endDate: "2030-01-11T00:00:00.000Z",
      },
      users.MANAGER,
    );
    const leaveId = created.data!.createLeaveRequest.id;

    const rejected = await run<{ rejectLeaveRequest: { status: string } }>(
      `mutation ($organizationId: String!, $id: String!) {
        rejectLeaveRequest(organizationId: $organizationId, id: $id) { status }
      }`,
      { organizationId, id: leaveId },
      users.MANAGER,
    );
    expect(rejected.data!.rejectLeaveRequest.status).toBe("REJECTED");

    const again = await run(
      `mutation ($organizationId: String!, $id: String!) {
        approveLeaveRequest(organizationId: $organizationId, id: $id) { status }
      }`,
      { organizationId, id: leaveId },
      users.MANAGER,
    );
    expect(errorMessage(again)).toMatch(/already been rejected/i);
  });

  it("validates the date range and rejects overlapping requests", async () => {
    const invalidRange = await run(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        type: "UNPAID",
        startDate: "2031-05-10T00:00:00.000Z",
        endDate: "2031-05-01T00:00:00.000Z",
      },
      users.MANAGER,
    );
    expect(errorMessage(invalidRange)).toMatch(/endDate must not be earlier/i);

    await run(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        type: "UNPAID",
        startDate: "2032-05-01T00:00:00.000Z",
        endDate: "2032-05-10T00:00:00.000Z",
      },
      users.MANAGER,
    );

    const overlapping = await run(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        type: "VACATION",
        startDate: "2032-05-05T00:00:00.000Z",
        endDate: "2032-05-15T00:00:00.000Z",
      },
      users.MANAGER,
    );
    expect(errorMessage(overlapping)).toMatch(/overlap/i);
  });

  it("prevents an employee from filing a request for somebody else", async () => {
    const result = await run(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        type: "SICK",
        startDate: "2033-01-01T00:00:00.000Z",
        endDate: "2033-01-02T00:00:00.000Z",
      },
      users.EMPLOYEE,
    );
    expect(errorMessage(result)).toMatch(/Owners and Managers/i);
  });

  it("prevents employees and supervisors from approving requests", async () => {
    const created = await run<{ createLeaveRequest: { id: string } }>(
      CREATE_LEAVE_REQUEST,
      {
        organizationId,
        employeeId: colleagueEmployeeId,
        type: "OTHER",
        startDate: "2034-01-01T00:00:00.000Z",
        endDate: "2034-01-02T00:00:00.000Z",
      },
      users.MANAGER,
    );
    const leaveId = created.data!.createLeaveRequest.id;

    for (const userId of [users.EMPLOYEE, users.SUPERVISOR]) {
      const result = await run(
        `mutation ($organizationId: String!, $id: String!) {
          approveLeaveRequest(organizationId: $organizationId, id: $id) { status }
        }`,
        { organizationId, id: leaveId },
        userId,
      );
      expect(errorMessage(result)).toMatch(/permission/i);
    }
  });

  it("only shows employees their own requests", async () => {
    const list = await run<{ leaveRequests: { employeeId: string }[] }>(
      `query ($organizationId: String!) {
        leaveRequests(organizationId: $organizationId) { employeeId }
      }`,
      { organizationId },
      users.EMPLOYEE,
    );
    expect(list.data!.leaveRequests.length).toBeGreaterThan(0);
    expect(list.data!.leaveRequests.every((item) => item.employeeId === selfEmployeeId)).toBe(true);

    const managerList = await run<{ leaveRequests: { employeeId: string }[] }>(
      `query ($organizationId: String!) {
        leaveRequests(organizationId: $organizationId) { employeeId }
      }`,
      { organizationId },
      users.MANAGER,
    );
    expect(
      managerList.data!.leaveRequests.some((item) => item.employeeId === colleagueEmployeeId),
    ).toBe(true);
  });
});
