import {
  ScheduleUpdateKind,
  toDateOnly,
  type ScheduleUpdatedPayload,
  type ShiftAssignmentChangedPayload,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { assignmentTopic, pubsub, scheduleTopic, SCHEDULE_UPDATED, SHIFT_ASSIGNMENT_CHANGED } from "../utils/pubsub";

export interface ScheduleUpdateInput {
  organizationId: string;
  scheduleId: string;
  kind: ScheduleUpdateKind;
  assignmentIds?: string[];
  actorId?: string | null;
}

export interface AssignmentChangeInput {
  organizationId: string;
  scheduleId: string;
  assignmentId: string;
  kind: ScheduleUpdateKind;
  employeeId?: string | null;
  date: Date;
  actorId?: string | null;
}

/** Publishes real-time schedule events to every connected subscriber. */
export class RealtimeService {
  async publishScheduleUpdate(input: ScheduleUpdateInput): Promise<ScheduleUpdatedPayload | null> {
    const schedule = await prisma.schedule.findFirst({
      where: { id: input.scheduleId, organizationId: input.organizationId },
      select: {
        id: true,
        weekStartDate: true,
        locationId: true,
        calendarId: true,
        version: true,
        updatedAt: true,
      },
    });
    if (!schedule) return null;
    const payload: ScheduleUpdatedPayload = {
      organizationId: input.organizationId,
      scheduleId: schedule.id,
      weekStartDate: toDateOnly(schedule.weekStartDate),
      locationId: schedule.locationId,
      calendarId: schedule.calendarId,
      kind: input.kind,
      assignmentIds: input.assignmentIds ?? [],
      actorId: input.actorId ?? null,
      version: schedule.version,
      updatedAt: new Date().toISOString(),
    };
    await pubsub.publish(scheduleTopic(input.organizationId), payload);
    return payload;
  }

  async publishAssignmentChange(input: AssignmentChangeInput): Promise<ShiftAssignmentChangedPayload> {
    const payload: ShiftAssignmentChangedPayload = {
      organizationId: input.organizationId,
      scheduleId: input.scheduleId,
      assignmentId: input.assignmentId,
      kind: input.kind,
      employeeId: input.employeeId ?? null,
      date: toDateOnly(input.date),
      actorId: input.actorId ?? null,
      updatedAt: new Date().toISOString(),
    };
    await pubsub.publish(assignmentTopic(input.organizationId), payload);
    return payload;
  }
}

export const realtimeService = new RealtimeService();
export { SCHEDULE_UPDATED, SHIFT_ASSIGNMENT_CHANGED };
