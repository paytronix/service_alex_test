import { prisma } from "../utils/prisma";
import { assertValidColor, assertValidName, withUniqueName } from "../utils/catalog";
import { AuditService } from "./audit.service";
import { locationService } from "./location.service";

export interface CreateCalendarInput {
  name: string;
  locationId?: string | null;
  color?: string | null;
}

export type UpdateCalendarInput = Partial<CreateCalendarInput>;

const auditService = new AuditService();

export class CalendarService {
  async list(organizationId: string, locationId?: string | null) {
    return prisma.calendar.findMany({
      where: { organizationId, ...(locationId ? { locationId } : {}) },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const calendar = await prisma.calendar.findFirst({ where: { id, organizationId } });
    if (!calendar) throw new Error("Calendar not found");
    return calendar;
  }

  async create(organizationId: string, userId: string, input: CreateCalendarInput) {
    await locationService.assertBelongs(organizationId, input.locationId);
    const calendar = await withUniqueName("Calendar", () =>
      prisma.calendar.create({
        data: {
          organizationId,
          name: assertValidName(input.name),
          locationId: input.locationId ?? null,
          color: input.color ? assertValidColor(input.color) : null,
        },
      }),
    );
    await auditService.log({
      userId,
      organizationId,
      action: "CALENDAR_CREATED",
      entity: "Calendar",
      entityId: calendar.id,
      meta: { name: calendar.name, locationId: calendar.locationId },
    });
    return calendar;
  }

  async update(organizationId: string, userId: string, id: string, input: UpdateCalendarInput) {
    await this.getById(organizationId, id);
    await locationService.assertBelongs(organizationId, input.locationId);
    const calendar = await withUniqueName("Calendar", () =>
      prisma.calendar.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: assertValidName(input.name) }),
          ...(input.locationId !== undefined && { locationId: input.locationId }),
          ...(input.color !== undefined && {
            color: input.color ? assertValidColor(input.color) : null,
          }),
        },
      }),
    );
    await auditService.log({
      userId,
      organizationId,
      action: "CALENDAR_UPDATED",
      entity: "Calendar",
      entityId: id,
      meta: { name: calendar.name },
    });
    return calendar;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const calendar = await this.getById(organizationId, id);
    await prisma.calendar.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "CALENDAR_DELETED",
      entity: "Calendar",
      entityId: id,
      meta: { name: calendar.name },
    });
    return true;
  }

  async assertBelongs(organizationId: string, calendarId?: string | null) {
    if (!calendarId) return;
    await this.getById(organizationId, calendarId);
  }
}

export const calendarService = new CalendarService();
