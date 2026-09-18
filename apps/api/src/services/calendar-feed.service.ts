import { randomBytes } from "crypto";
import { CalendarFeedScope, ScheduleStatus } from "@prisma/client";
import { shiftInterval, toDateOnly } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";

const auditService = new AuditService();

function publicBaseUrl(): string {
  return (process.env.PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
}

function icsEscape(value: string): string {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

function icsTimestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** iCal subscription tokens and feed rendering for external calendar apps. */
export class CalendarFeedService {
  feedUrl(token: string): string {
    return `${publicBaseUrl()}/api/calendar/${token}.ics`;
  }

  async list(organizationId: string, employeeId?: string | null) {
    return prisma.calendarFeedToken.findMany({
      where: { organizationId, ...(employeeId ? { employeeId } : {}), revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async issue(
    organizationId: string,
    userId: string,
    input: { scope: CalendarFeedScope; employeeId?: string | null },
  ) {
    if (input.scope === CalendarFeedScope.EMPLOYEE && !input.employeeId) {
      throw new Error("employeeId is required for an employee-scoped feed");
    }
    if (input.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.employeeId, organizationId },
      });
      if (!employee) throw new Error("Employee not found");
    }
    const token = await prisma.calendarFeedToken.create({
      data: {
        organizationId,
        employeeId: input.scope === CalendarFeedScope.EMPLOYEE ? input.employeeId : null,
        scope: input.scope,
        token: randomBytes(24).toString("base64url"),
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "CALENDAR_FEED_TOKEN_ISSUED",
      entity: "CalendarFeedToken",
      entityId: token.id,
      meta: { scope: input.scope, employeeId: token.employeeId },
    });
    return token;
  }

  async revoke(organizationId: string, userId: string, id: string) {
    const token = await prisma.calendarFeedToken.findFirst({ where: { id, organizationId } });
    if (!token) throw new Error("Calendar feed token not found");
    const revoked = await prisma.calendarFeedToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "CALENDAR_FEED_TOKEN_REVOKED",
      entity: "CalendarFeedToken",
      entityId: id,
    });
    return revoked;
  }

  /** Renders the feed for a token; only published schedules are exposed. */
  async render(token: string): Promise<string> {
    const feed = await prisma.calendarFeedToken.findFirst({
      where: { token, revokedAt: null },
    });
    if (!feed) throw new Error("Calendar feed not found");

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        organizationId: feed.organizationId,
        ...(feed.employeeId ? { employeeId: feed.employeeId } : {}),
        schedule: { status: ScheduleStatus.PUBLISHED },
      },
      include: {
        shiftTemplate: true,
        employee: {
          select: { firstName: true, lastName: true, location: { select: { name: true } } },
        },
      },
      orderBy: { date: "asc" },
      take: 1000,
    });
    await prisma.calendarFeedToken.update({
      where: { id: feed.id },
      data: { lastUsedAt: new Date() },
    });

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ShiftFlow//Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${icsEscape(feed.employeeId ? "My shifts" : "Organization shifts")}`,
    ];
    for (const assignment of assignments) {
      const { start, end } = shiftInterval(
        toDateOnly(assignment.date),
        assignment.startTime ?? assignment.shiftTemplate.startTime,
        assignment.endTime ?? assignment.shiftTemplate.endTime,
      );
      lines.push(
        "BEGIN:VEVENT",
        `UID:${assignment.id}@shiftflow`,
        `DTSTAMP:${icsTimestamp(assignment.updatedAt)}`,
        `DTSTART:${icsTimestamp(start)}`,
        `DTEND:${icsTimestamp(end)}`,
        `SUMMARY:${icsEscape(
          `${assignment.shiftTemplate.name} — ${assignment.employee.firstName} ${assignment.employee.lastName}`,
        )}`,
        ...(assignment.employee.location
          ? [`LOCATION:${icsEscape(assignment.employee.location.name)}`]
          : []),
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  }
}

export const calendarFeedService = new CalendarFeedService();
