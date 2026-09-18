import { Prisma, ScheduleChangeType } from "@prisma/client";
import { toDateOnly } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";

export interface RecordChangeInput {
  organizationId: string;
  scheduleId: string;
  assignmentId: string;
  changeType: ScheduleChangeType;
  date: Date;
  previousEmployeeId?: string | null;
  newEmployeeId?: string | null;
  changedById?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface SnapshotAssignment {
  id: string;
  employeeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  roleId: string | null;
  shiftTemplateId: string;
}

export interface VersionDiffEntry {
  assignmentId: string;
  changeType: ScheduleChangeType;
  date: string;
  previousEmployeeId: string | null;
  newEmployeeId: string | null;
}

export class ScheduleHistoryService {
  async record(input: RecordChangeInput) {
    return prisma.shiftAssignmentHistory.create({
      data: {
        organizationId: input.organizationId,
        scheduleId: input.scheduleId,
        assignmentId: input.assignmentId,
        changeType: input.changeType,
        date: new Date(`${toDateOnly(input.date)}T00:00:00.000Z`),
        previousEmployeeId: input.previousEmployeeId ?? null,
        newEmployeeId: input.newEmployeeId ?? null,
        changedById: input.changedById ?? null,
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    });
  }

  async versions(organizationId: string, scheduleId: string) {
    return prisma.scheduleVersion.findMany({
      where: { organizationId, scheduleId },
      orderBy: { version: "desc" },
      include: {
        publishedBy: {
          select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true },
        },
      },
    });
  }

  async version(organizationId: string, scheduleId: string, version: number) {
    const record = await prisma.scheduleVersion.findFirst({
      where: { organizationId, scheduleId, version },
    });
    if (!record) throw new Error(`Schedule version ${version} not found`);
    return record;
  }

  async changeHistory(
    organizationId: string,
    scheduleId: string,
    skip = 0,
    take = 50,
  ) {
    return prisma.shiftAssignmentHistory.findMany({
      where: { organizationId, scheduleId },
      orderBy: { changedAt: "desc" },
      skip,
      take: Math.min(take, 200),
      include: {
        changedBy: {
          select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true },
        },
      },
    });
  }

  /** Compares two published snapshots of the same schedule. */
  async diff(
    organizationId: string,
    scheduleId: string,
    versionA: number,
    versionB: number,
  ): Promise<VersionDiffEntry[]> {
    const [from, to] = await Promise.all([
      this.version(organizationId, scheduleId, versionA),
      this.version(organizationId, scheduleId, versionB),
    ]);
    const before = indexSnapshot(from.snapshot);
    const after = indexSnapshot(to.snapshot);
    const entries: VersionDiffEntry[] = [];

    for (const [id, assignment] of after) {
      const previous = before.get(id);
      if (!previous) {
        entries.push({
          assignmentId: id,
          changeType: ScheduleChangeType.CREATED,
          date: assignment.date,
          previousEmployeeId: null,
          newEmployeeId: assignment.employeeId,
        });
        continue;
      }
      if (previous.employeeId !== assignment.employeeId) {
        entries.push({
          assignmentId: id,
          changeType: ScheduleChangeType.REPLACED,
          date: assignment.date,
          previousEmployeeId: previous.employeeId,
          newEmployeeId: assignment.employeeId,
        });
      } else if (
        previous.date !== assignment.date ||
        previous.startTime !== assignment.startTime ||
        previous.endTime !== assignment.endTime
      ) {
        entries.push({
          assignmentId: id,
          changeType: ScheduleChangeType.MOVED,
          date: assignment.date,
          previousEmployeeId: previous.employeeId,
          newEmployeeId: assignment.employeeId,
        });
      }
    }

    for (const [id, assignment] of before) {
      if (after.has(id)) continue;
      entries.push({
        assignmentId: id,
        changeType: ScheduleChangeType.REMOVED,
        date: assignment.date,
        previousEmployeeId: assignment.employeeId,
        newEmployeeId: null,
      });
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }
}

function indexSnapshot(snapshot: Prisma.JsonValue): Map<string, SnapshotAssignment> {
  const entries = Array.isArray(snapshot) ? snapshot : [];
  const map = new Map<string, SnapshotAssignment>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : null;
    if (!id) continue;
    map.set(id, {
      id,
      employeeId: typeof item.employeeId === "string" ? item.employeeId : "",
      date: typeof item.date === "string" ? item.date : "",
      startTime: typeof item.startTime === "string" ? item.startTime : null,
      endTime: typeof item.endTime === "string" ? item.endTime : null,
      roleId: typeof item.roleId === "string" ? item.roleId : null,
      shiftTemplateId: typeof item.shiftTemplateId === "string" ? item.shiftTemplateId : "",
    });
  }
  return map;
}

export const scheduleHistoryService = new ScheduleHistoryService();
