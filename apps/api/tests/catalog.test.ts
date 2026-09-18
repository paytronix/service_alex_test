import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { graphql, ExecutionResult } from "graphql";
import { MembershipRole } from "@prisma/client";
import { schema } from "../src/schema";
import { prisma } from "../src/utils/prisma";
import type { GraphQLContext } from "../src/middleware/auth";

const SUFFIX = `catalog-${Date.now()}`;

const users: Record<MembershipRole, string> = {
  OWNER: "",
  MANAGER: "",
  SUPERVISOR: "",
  EMPLOYEE: "",
};

let organizationId = "";
let otherOrganizationId = "";

function createContext(userId: string | null): GraphQLContext {
  return {
    user: userId ? { userId, email: `${userId}@example.com` } : null,
    prisma,
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
    await prisma.membership.create({
      data: { userId: user.id, organizationId, role },
    });
  }
});

afterAll(async () => {
  await prisma.organization.deleteMany({
    where: { id: { in: [organizationId, otherOrganizationId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

const CREATE_DEPARTMENT = `
  mutation ($organizationId: String!, $name: String!) {
    createDepartment(organizationId: $organizationId, name: $name) { id name organizationId }
  }
`;

const DEPARTMENTS = `
  query ($organizationId: String!) {
    departments(organizationId: $organizationId) { id name }
  }
`;

describe("Department CRUD", () => {
  it("creates, reads, updates and deletes a department", async () => {
    const created = await run<{ createDepartment: { id: string; name: string } }>(
      CREATE_DEPARTMENT,
      { organizationId, name: "Kitchen" },
      users.OWNER,
    );
    const department = created.data!.createDepartment;
    expect(department.name).toBe("Kitchen");

    const read = await run(
      `query ($organizationId: String!, $id: String!) {
        department(organizationId: $organizationId, id: $id) { id name }
      }`,
      { organizationId, id: department.id },
      users.EMPLOYEE,
    );
    expect(read.data).toMatchObject({ department: { name: "Kitchen" } });

    const updated = await run(
      `mutation ($organizationId: String!, $id: String!, $name: String!) {
        updateDepartment(organizationId: $organizationId, id: $id, name: $name) { name }
      }`,
      { organizationId, id: department.id, name: "Bar" },
      users.MANAGER,
    );
    expect(updated.data).toMatchObject({ updateDepartment: { name: "Bar" } });

    const deleted = await run(
      `mutation ($organizationId: String!, $id: String!) {
        deleteDepartment(organizationId: $organizationId, id: $id)
      }`,
      { organizationId, id: department.id },
      users.OWNER,
    );
    expect(deleted.data).toEqual({ deleteDepartment: true });
  });

  it("rejects an empty name", async () => {
    const result = await run(CREATE_DEPARTMENT, { organizationId, name: "   " }, users.OWNER);
    expect(errorMessage(result)).toContain("Name must not be empty");
  });

  it("rejects a duplicate name within the organization", async () => {
    await run(CREATE_DEPARTMENT, { organizationId, name: "Warehouse" }, users.OWNER);
    const duplicate = await run(
      CREATE_DEPARTMENT,
      { organizationId, name: "Warehouse" },
      users.OWNER,
    );
    expect(errorMessage(duplicate)).toContain("already exists");
  });

  it("writes an audit log entry on creation", async () => {
    const created = await run<{ createDepartment: { id: string } }>(
      CREATE_DEPARTMENT,
      { organizationId, name: "Audited" },
      users.OWNER,
    );
    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: created.data!.createDepartment.id, action: "DEPARTMENT_CREATED" },
    });
    expect(auditLog).not.toBeNull();
  });
});

describe("Organization scoping", () => {
  it("does not expose entities from another organization", async () => {
    const foreign = await prisma.department.create({
      data: { name: "Foreign", organizationId: otherOrganizationId },
    });

    const list = await run<{ departments: { id: string }[] }>(
      DEPARTMENTS,
      { organizationId },
      users.OWNER,
    );
    expect(list.data!.departments.map((d) => d.id)).not.toContain(foreign.id);

    const read = await run(
      `query ($organizationId: String!, $id: String!) {
        department(organizationId: $organizationId, id: $id) { id }
      }`,
      { organizationId, id: foreign.id },
      users.OWNER,
    );
    expect(errorMessage(read)).toContain("Department not found");
  });

  it("denies access to organizations the user is not a member of", async () => {
    const result = await run(DEPARTMENTS, { organizationId: otherOrganizationId }, users.OWNER);
    expect(errorMessage(result)).toContain("Not a member");
  });
});

describe("RBAC", () => {
  it.each([MembershipRole.SUPERVISOR, MembershipRole.EMPLOYEE])(
    "rejects catalog mutations from %s",
    async (role) => {
      const result = await run(
        CREATE_DEPARTMENT,
        { organizationId, name: `Denied ${role}` },
        users[role],
      );
      expect(errorMessage(result)).toContain("Insufficient permissions");
    },
  );

  it.each([MembershipRole.OWNER, MembershipRole.MANAGER])(
    "allows catalog mutations from %s",
    async (role) => {
      const result = await run(
        CREATE_DEPARTMENT,
        { organizationId, name: `Allowed ${role}` },
        users[role],
      );
      expect(result.errors).toBeUndefined();
    },
  );

  it.each([
    MembershipRole.OWNER,
    MembershipRole.MANAGER,
    MembershipRole.SUPERVISOR,
    MembershipRole.EMPLOYEE,
  ])("allows queries from %s", async (role) => {
    const result = await run(DEPARTMENTS, { organizationId }, users[role]);
    expect(result.errors).toBeUndefined();
  });

  it("rejects unauthenticated queries", async () => {
    const result = await run(DEPARTMENTS, { organizationId }, null);
    expect(errorMessage(result)).toContain("Not authorized");
  });
});

describe("Role CRUD", () => {
  const CREATE_ROLE = `
    mutation (
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

  it("creates a role with color, description, load and rate", async () => {
    const result = await run<{
      createRole: {
        id: string;
        color: string;
        maxLoad: number;
        hourlyRate: number;
        description: string;
      };
    }>(
      CREATE_ROLE,
      {
        organizationId,
        name: "Barista",
        color: "#ff8800",
        description: "Makes coffee",
        maxLoad: 5,
        hourlyRate: 21.5,
      },
      users.OWNER,
    );

    expect(result.data!.createRole).toMatchObject({
      color: "#FF8800",
      description: "Makes coffee",
      maxLoad: 5,
      hourlyRate: 21.5,
    });
  });

  it("uses the default color when none is provided", async () => {
    const result = await run<{ createRole: { color: string } }>(
      CREATE_ROLE,
      { organizationId, name: "Host" },
      users.OWNER,
    );
    expect(result.data!.createRole.color).toBe("#3B82F6");
  });

  it("rejects an invalid color", async () => {
    const result = await run(
      CREATE_ROLE,
      { organizationId, name: "Invalid color", color: "blue" },
      users.OWNER,
    );
    expect(errorMessage(result)).toContain("Invalid color");
  });

  it("updates a role", async () => {
    const created = await run<{ createRole: { id: string } }>(
      CREATE_ROLE,
      { organizationId, name: "Cashier", color: "#123456" },
      users.OWNER,
    );
    const updated = await run(
      `mutation ($organizationId: String!, $id: String!, $color: String, $maxLoad: Int) {
        updateRole(organizationId: $organizationId, id: $id, color: $color, maxLoad: $maxLoad) {
          color
          maxLoad
        }
      }`,
      { organizationId, id: created.data!.createRole.id, color: "#abcdef", maxLoad: 3 },
      users.MANAGER,
    );
    expect(updated.data).toMatchObject({ updateRole: { color: "#ABCDEF", maxLoad: 3 } });
  });
});

describe("Skill CRUD", () => {
  it("creates and lists skills scoped to the organization", async () => {
    const created = await run<{ createSkill: { id: string; name: string } }>(
      `mutation ($organizationId: String!, $name: String!) {
        createSkill(organizationId: $organizationId, name: $name) { id name }
      }`,
      { organizationId, name: "Latte art" },
      users.OWNER,
    );
    expect(created.data!.createSkill.name).toBe("Latte art");

    const list = await run<{ skills: { id: string }[] }>(
      `query ($organizationId: String!) {
        skills(organizationId: $organizationId) { id }
      }`,
      { organizationId },
      users.EMPLOYEE,
    );
    expect(list.data!.skills.map((s) => s.id)).toContain(created.data!.createSkill.id);
  });
});

describe("ShiftTemplate CRUD", () => {
  const CREATE_TEMPLATE = `
    mutation (
      $organizationId: String!
      $name: String!
      $startTime: String!
      $endTime: String!
      $roleId: String
      $minEmployees: Int
      $maxEmployees: Int
    ) {
      createShiftTemplate(
        organizationId: $organizationId
        name: $name
        startTime: $startTime
        endTime: $endTime
        roleId: $roleId
        minEmployees: $minEmployees
        maxEmployees: $maxEmployees
      ) {
        id
        startTime
        endTime
        crossesMidnight
      }
    }
  `;

  it("flags night shifts as crossing midnight", async () => {
    const result = await run<{ createShiftTemplate: { crossesMidnight: boolean } }>(
      CREATE_TEMPLATE,
      { organizationId, name: "Night", startTime: "23:00", endTime: "08:00" },
      users.OWNER,
    );
    expect(result.data!.createShiftTemplate.crossesMidnight).toBe(true);
  });

  it("does not flag day shifts as crossing midnight", async () => {
    const result = await run<{ createShiftTemplate: { crossesMidnight: boolean } }>(
      CREATE_TEMPLATE,
      { organizationId, name: "Morning", startTime: "08:00", endTime: "16:00" },
      users.OWNER,
    );
    expect(result.data!.createShiftTemplate.crossesMidnight).toBe(false);
  });

  it("rejects an invalid time format", async () => {
    const result = await run(
      CREATE_TEMPLATE,
      { organizationId, name: "Broken", startTime: "9am", endTime: "17:00" },
      users.OWNER,
    );
    expect(errorMessage(result)).toContain("Invalid startTime");
  });

  it("rejects maxEmployees below minEmployees", async () => {
    const result = await run(
      CREATE_TEMPLATE,
      {
        organizationId,
        name: "Bad range",
        startTime: "08:00",
        endTime: "16:00",
        minEmployees: 3,
        maxEmployees: 2,
      },
      users.OWNER,
    );
    expect(errorMessage(result)).toContain("maxEmployees must be greater than or equal");
  });

  it("rejects a role from another organization", async () => {
    const foreignRole = await prisma.role.create({
      data: { name: "Foreign role", organizationId: otherOrganizationId },
    });
    const result = await run(
      CREATE_TEMPLATE,
      {
        organizationId,
        name: "Foreign role template",
        startTime: "08:00",
        endTime: "16:00",
        roleId: foreignRole.id,
      },
      users.OWNER,
    );
    expect(errorMessage(result)).toContain("Role not found");
  });

  it("recomputes crossesMidnight on update", async () => {
    const created = await run<{ createShiftTemplate: { id: string } }>(
      CREATE_TEMPLATE,
      { organizationId, name: "Evening", startTime: "14:00", endTime: "22:00" },
      users.OWNER,
    );
    const updated = await run(
      `mutation ($organizationId: String!, $id: String!, $endTime: String) {
        updateShiftTemplate(organizationId: $organizationId, id: $id, endTime: $endTime) {
          endTime
          crossesMidnight
        }
      }`,
      { organizationId, id: created.data!.createShiftTemplate.id, endTime: "02:00" },
      users.MANAGER,
    );
    expect(updated.data).toMatchObject({
      updateShiftTemplate: { endTime: "02:00", crossesMidnight: true },
    });
  });
});
