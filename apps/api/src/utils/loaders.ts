import DataLoader from "dataloader";
import type {
  Availability,
  Department,
  EmployeeSkill,
  Role,
  Skill,
} from "@prisma/client";
import { prisma } from "./prisma";

export interface Loaders {
  role: DataLoader<string, Role | null>;
  department: DataLoader<string, Department | null>;
  skill: DataLoader<string, Skill | null>;
  employeeSkills: DataLoader<string, EmployeeSkill[]>;
  employeeAvailability: DataLoader<string, Availability[]>;
}

function groupBy<T, K extends keyof T>(rows: T[], key: K, ids: readonly string[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = String(row[key]);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return ids.map((id) => groups.get(id) ?? []);
}

function byId<T extends { id: string }>(rows: T[], ids: readonly string[]): (T | null)[] {
  const map = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => map.get(id) ?? null);
}

export function createLoaders(): Loaders {
  return {
    role: new DataLoader(async (ids) =>
      byId(await prisma.role.findMany({ where: { id: { in: [...ids] } } }), ids),
    ),
    department: new DataLoader(async (ids) =>
      byId(await prisma.department.findMany({ where: { id: { in: [...ids] } } }), ids),
    ),
    skill: new DataLoader(async (ids) =>
      byId(await prisma.skill.findMany({ where: { id: { in: [...ids] } } }), ids),
    ),
    employeeSkills: new DataLoader(async (employeeIds) =>
      groupBy(
        await prisma.employeeSkill.findMany({
          where: { employeeId: { in: [...employeeIds] } },
          orderBy: { createdAt: "asc" },
        }),
        "employeeId",
        employeeIds,
      ),
    ),
    employeeAvailability: new DataLoader(async (employeeIds) =>
      groupBy(
        await prisma.availability.findMany({
          where: { employeeId: { in: [...employeeIds] } },
          orderBy: { dayOfWeek: "asc" },
        }),
        "employeeId",
        employeeIds,
      ),
    ),
  };
}
