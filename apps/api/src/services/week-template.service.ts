import { ScheduleStatus, type RecurringShiftRule } from "@prisma/client";
import {
  addDays,
  isRuleEffectiveOn,
  ScheduleUpdateKind,
  startOfWeek,
  toDateOnly,
  type Violation,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { assertValidName, withUniqueName } from "../utils/catalog";
import { AuditService } from "./audit.service";
import { calendarService } from "./calendar.service";
import { locationService } from "./location.service";
import { realtimeService } from "./realtime.service";
import { ScheduleService } from "./schedule.service";
import { ScheduleValidationService } from "./schedule-validation.service";

export interface CreateWeekTemplateInput {
  name: string;
  description?: string | null;
  locationId?: string | null;
  calendarId?: string | null;
}

export type UpdateWeekTemplateInput = Partial<CreateWeekTemplateInput>;

export interface RecurringRuleInput {
  weekTemplateId?: string | null;
  dayOfWeek: number;
  shiftTemplateId: string;
  roleId?: string | null;
  employeeId?: string | null;
  requiredCount?: number;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
}

export interface GenerateScheduleInput {
  weekStartDate: Date;
  weekTemplateId?: string | null;
  recurringRuleIds?: string[] | null;
  locationId?: string | null;
  calendarId?: string | null;
}

export interface GenerateScheduleResult {
  schedule: Awaited<ReturnType<ScheduleService["createDraft"]>>;
  createdAssignmentIds: string[];
  createdRequirementIds: string[];
  skipped: Array<{ ruleId: string; date: string; reason: string }>;
  violations: Violation[];
}

const auditService = new AuditService();
const scheduleService = new ScheduleService();
const validationService = new ScheduleValidationService();

function dateOnlyUtc(date: Date): Date {
  return new Date(`${toDateOnly(date)}T00:00:00.000Z`);
}

export class WeekTemplateService {
  // ─── Week templates ────────────────────────────────────────

  async list(organizationId: string, locationId?: string | null) {
    return prisma.weekTemplate.findMany({
      where: { organizationId, ...(locationId ? { locationId } : {}) },
      orderBy: { name: "asc" },
      include: { rules: { orderBy: [{ dayOfWeek: "asc" }] } },
    });
  }

  async getById(organizationId: string, id: string) {
    const template = await prisma.weekTemplate.findFirst({
      where: { id, organizationId },
      include: { rules: { orderBy: [{ dayOfWeek: "asc" }] } },
    });
    if (!template) throw new Error("Week template not found");
    return template;
  }

  async create(organizationId: string, userId: string, input: CreateWeekTemplateInput) {
    await locationService.assertBelongs(organizationId, input.locationId);
    await calendarService.assertBelongs(organizationId, input.calendarId);
    const template = await withUniqueName("Week template", () =>
      prisma.weekTemplate.create({
        data: {
          organizationId,
          name: assertValidName(input.name),
          description: input.description?.trim() || null,
          locationId: input.locationId ?? null,
          calendarId: input.calendarId ?? null,
        },
        include: { rules: true },
      }),
    );
    await auditService.log({
      userId,
      organizationId,
      action: "WEEK_TEMPLATE_CREATED",
      entity: "WeekTemplate",
      entityId: template.id,
      meta: { name: template.name },
    });
    return template;
  }

  async update(organizationId: string, userId: string, id: string, input: UpdateWeekTemplateInput) {
    await this.getById(organizationId, id);
    await locationService.assertBelongs(organizationId, input.locationId);
    await calendarService.assertBelongs(organizationId, input.calendarId);
    const template = await withUniqueName("Week template", () =>
      prisma.weekTemplate.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: assertValidName(input.name) }),
          ...(input.description !== undefined && { description: input.description?.trim() || null }),
          ...(input.locationId !== undefined && { locationId: input.locationId }),
          ...(input.calendarId !== undefined && { calendarId: input.calendarId }),
        },
        include: { rules: true },
      }),
    );
    await auditService.log({
      userId,
      organizationId,
      action: "WEEK_TEMPLATE_UPDATED",
      entity: "WeekTemplate",
      entityId: id,
      meta: { name: template.name },
    });
    return template;
  }

  async delete(organizationId: string, userId: string, id: string) {
    await this.getById(organizationId, id);
    await prisma.weekTemplate.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "WEEK_TEMPLATE_DELETED",
      entity: "WeekTemplate",
      entityId: id,
    });
    return true;
  }

  // ─── Recurring rules ───────────────────────────────────────

  async listRules(organizationId: string, weekTemplateId?: string | null) {
    return prisma.recurringShiftRule.findMany({
      where: {
        organizationId,
        ...(weekTemplateId === undefined ? {} : { weekTemplateId }),
      },
      orderBy: [{ dayOfWeek: "asc" }, { createdAt: "asc" }],
    });
  }

  async createRule(organizationId: string, userId: string, input: RecurringRuleInput) {
    const data = await this.ruleData(organizationId, input);
    const rule = await prisma.recurringShiftRule.create({ data: { organizationId, ...data } });
    await auditService.log({
      userId,
      organizationId,
      action: "RECURRING_RULE_CREATED",
      entity: "RecurringShiftRule",
      entityId: rule.id,
      meta: { dayOfWeek: rule.dayOfWeek, shiftTemplateId: rule.shiftTemplateId },
    });
    return rule;
  }

  async updateRule(
    organizationId: string,
    userId: string,
    id: string,
    input: Partial<RecurringRuleInput>,
  ) {
    const existing = await prisma.recurringShiftRule.findFirst({ where: { id, organizationId } });
    if (!existing) throw new Error("Recurring shift rule not found");
    const data = await this.ruleData(organizationId, { ...this.toInput(existing), ...input });
    const rule = await prisma.recurringShiftRule.update({ where: { id }, data });
    await auditService.log({
      userId,
      organizationId,
      action: "RECURRING_RULE_UPDATED",
      entity: "RecurringShiftRule",
      entityId: id,
    });
    return rule;
  }

  async deleteRule(organizationId: string, userId: string, id: string) {
    const existing = await prisma.recurringShiftRule.findFirst({ where: { id, organizationId } });
    if (!existing) throw new Error("Recurring shift rule not found");
    await prisma.recurringShiftRule.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "RECURRING_RULE_DELETED",
      entity: "RecurringShiftRule",
      entityId: id,
    });
    return true;
  }

  // ─── Generation ────────────────────────────────────────────

  /**
   * Creates (or reuses) the draft week and materializes requirements and
   * assignments from the given week template or explicit recurring rules.
   */
  async generateSchedule(
    organizationId: string,
    userId: string,
    input: GenerateScheduleInput,
  ): Promise<GenerateScheduleResult> {
    if (!input.weekTemplateId && !input.recurringRuleIds?.length) {
      throw new Error("Either weekTemplateId or recurringRuleIds must be provided");
    }
    const template = input.weekTemplateId
      ? await this.getById(organizationId, input.weekTemplateId)
      : null;
    const rules = input.recurringRuleIds?.length
      ? await prisma.recurringShiftRule.findMany({
          where: { organizationId, id: { in: input.recurringRuleIds } },
        })
      : (template?.rules ?? []);
    if (rules.length === 0) throw new Error("No recurring rules to generate from");

    const locationId = input.locationId ?? template?.locationId ?? null;
    const calendarId = input.calendarId ?? template?.calendarId ?? null;
    const weekStart = startOfWeek(input.weekStartDate);
    const schedule = await scheduleService.createDraft(organizationId, userId, weekStart, {
      locationId,
      calendarId,
    });
    if (schedule.status !== ScheduleStatus.DRAFT) {
      throw new Error("Published schedules cannot be regenerated");
    }

    const shiftTemplates = await prisma.shiftTemplate.findMany({
      where: { organizationId, id: { in: rules.map((rule) => rule.shiftTemplateId) } },
    });
    const templateById = new Map(shiftTemplates.map((item) => [item.id, item]));

    const createdAssignmentIds: string[] = [];
    const createdRequirementIds: string[] = [];
    const skipped: Array<{ ruleId: string; date: string; reason: string }> = [];
    const violations: Violation[] = [];

    for (const rule of rules) {
      const shiftTemplate = templateById.get(rule.shiftTemplateId);
      if (!shiftTemplate) {
        skipped.push({ ruleId: rule.id, date: "", reason: "Shift template not found" });
        continue;
      }
      const dayOffset = (rule.dayOfWeek + 6) % 7; // week starts on Monday
      const date = dateOnlyUtc(addDays(weekStart, dayOffset));
      if (!isRuleEffectiveOn({ effectiveFrom: rule.effectiveFrom?.toISOString() ?? null, effectiveTo: rule.effectiveTo?.toISOString() ?? null }, date)) {
        skipped.push({ ruleId: rule.id, date: toDateOnly(date), reason: "Rule is not effective for this week" });
        continue;
      }
      const roleId = rule.roleId ?? shiftTemplate.roleId;
      if (roleId) {
        const requirement = await prisma.shiftRequirement.upsert({
          where: {
            scheduleId_date_shiftTemplateId_roleId: {
              scheduleId: schedule.id,
              date,
              shiftTemplateId: rule.shiftTemplateId,
              roleId,
            },
          },
          update: { requiredCount: rule.requiredCount, locationId },
          create: {
            organizationId,
            scheduleId: schedule.id,
            locationId,
            date,
            shiftTemplateId: rule.shiftTemplateId,
            roleId,
            requiredCount: rule.requiredCount,
          },
        });
        createdRequirementIds.push(requirement.id);
      } else {
        skipped.push({
          ruleId: rule.id,
          date: toDateOnly(date),
          reason: "Rule has no role and its shift template has no default role",
        });
      }

      if (!rule.employeeId) continue;
      const validation = await validationService.validate(organizationId, {
        id: null,
        scheduleId: schedule.id,
        shiftTemplateId: rule.shiftTemplateId,
        employeeId: rule.employeeId,
        date: toDateOnly(date),
        startTime: shiftTemplate.startTime,
        endTime: shiftTemplate.endTime,
        breakMinutes: shiftTemplate.breakMinutes,
        roleId: roleId ?? null,
      });
      violations.push(...validation.violations);
      if (validation.hasErrors) {
        skipped.push({
          ruleId: rule.id,
          date: toDateOnly(date),
          reason: validation.violations
            .filter((violation) => violation.level === "ERROR")
            .map((violation) => violation.message)
            .join("; "),
        });
        continue;
      }
      const assignment = await prisma.shiftAssignment.create({
        data: {
          organizationId,
          scheduleId: schedule.id,
          employeeId: rule.employeeId,
          shiftTemplateId: rule.shiftTemplateId,
          roleId: roleId ?? null,
          calendarId,
          date,
          breakMinutes: shiftTemplate.breakMinutes,
        },
      });
      createdAssignmentIds.push(assignment.id);
    }

    await auditService.log({
      userId,
      organizationId,
      action: "SCHEDULE_GENERATED_FROM_TEMPLATE",
      entity: "Schedule",
      entityId: schedule.id,
      meta: {
        weekTemplateId: input.weekTemplateId ?? null,
        ruleCount: rules.length,
        assignments: createdAssignmentIds.length,
        requirements: createdRequirementIds.length,
        skipped: skipped.length,
      },
    });
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: schedule.id,
      kind: ScheduleUpdateKind.SCHEDULE_GENERATED,
      assignmentIds: createdAssignmentIds,
      actorId: userId,
    });

    const refreshed = await scheduleService.getById(organizationId, schedule.id);
    if (!refreshed) throw new Error("Schedule not found");
    return { schedule: refreshed, createdAssignmentIds, createdRequirementIds, skipped, violations };
  }

  /** Stores the assignments of an existing week as a reusable week template. */
  async saveWeekAsTemplate(
    organizationId: string,
    userId: string,
    scheduleId: string,
    name: string,
    description?: string | null,
  ) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, organizationId },
      include: { assignments: true },
    });
    if (!schedule) throw new Error("Schedule not found");

    const template = await this.create(organizationId, userId, {
      name,
      description: description ?? null,
      locationId: schedule.locationId,
      calendarId: schedule.calendarId,
    });

    const grouped = new Map<string, { dayOfWeek: number; shiftTemplateId: string; roleId: string | null; count: number }>();
    for (const assignment of schedule.assignments) {
      const dayOfWeek = assignment.date.getUTCDay();
      const key = `${dayOfWeek}:${assignment.shiftTemplateId}:${assignment.roleId ?? ""}`;
      const entry = grouped.get(key);
      if (entry) entry.count += 1;
      else
        grouped.set(key, {
          dayOfWeek,
          shiftTemplateId: assignment.shiftTemplateId,
          roleId: assignment.roleId,
          count: 1,
        });
    }

    if (grouped.size > 0) {
      await prisma.recurringShiftRule.createMany({
        data: [...grouped.values()].map((entry) => ({
          organizationId,
          weekTemplateId: template.id,
          dayOfWeek: entry.dayOfWeek,
          shiftTemplateId: entry.shiftTemplateId,
          roleId: entry.roleId,
          requiredCount: entry.count,
        })),
      });
    }

    await auditService.log({
      userId,
      organizationId,
      action: "WEEK_TEMPLATE_CREATED",
      entity: "WeekTemplate",
      entityId: template.id,
      meta: { scheduleId, ruleCount: grouped.size },
    });
    return this.getById(organizationId, template.id);
  }

  // ─── Helpers ───────────────────────────────────────────────

  private toInput(rule: RecurringShiftRule): RecurringRuleInput {
    return {
      weekTemplateId: rule.weekTemplateId,
      dayOfWeek: rule.dayOfWeek,
      shiftTemplateId: rule.shiftTemplateId,
      roleId: rule.roleId,
      employeeId: rule.employeeId,
      requiredCount: rule.requiredCount,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    };
  }

  private async ruleData(organizationId: string, input: RecurringRuleInput) {
    if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new Error("dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)");
    }
    const requiredCount = input.requiredCount ?? 1;
    if (requiredCount < 1) throw new Error("requiredCount must be at least 1");
    if (input.effectiveFrom && input.effectiveTo && input.effectiveFrom > input.effectiveTo) {
      throw new Error("effectiveFrom must be before effectiveTo");
    }
    const [shiftTemplate, role, employee, weekTemplate] = await Promise.all([
      prisma.shiftTemplate.findFirst({ where: { id: input.shiftTemplateId, organizationId } }),
      input.roleId ? prisma.role.findFirst({ where: { id: input.roleId, organizationId } }) : null,
      input.employeeId
        ? prisma.employee.findFirst({ where: { id: input.employeeId, organizationId } })
        : null,
      input.weekTemplateId
        ? prisma.weekTemplate.findFirst({ where: { id: input.weekTemplateId, organizationId } })
        : null,
    ]);
    if (!shiftTemplate) throw new Error("Shift template not found");
    if (input.roleId && !role) throw new Error("Role not found");
    if (input.employeeId && !employee) throw new Error("Employee not found");
    if (input.weekTemplateId && !weekTemplate) throw new Error("Week template not found");
    return {
      weekTemplateId: input.weekTemplateId ?? null,
      dayOfWeek: input.dayOfWeek,
      shiftTemplateId: input.shiftTemplateId,
      roleId: input.roleId ?? null,
      employeeId: input.employeeId ?? null,
      requiredCount,
      effectiveFrom: input.effectiveFrom ? dateOnlyUtc(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? dateOnlyUtc(input.effectiveTo) : null,
    };
  }
}

export const weekTemplateService = new WeekTemplateService();
