import {
  AvailabilityType,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  ScheduleStatus,
  ShiftAssignmentStatus,
} from "./enums";
import {
  crossesMidnight,
  shiftDurationMinutes,
  timeToMinutes,
} from "./validation";
import type { AvailabilityDto } from "./employee";

export enum ViolationLevel {
  ERROR = "ERROR",
  WARNING = "WARNING",
}

export enum ViolationCode {
  OVERLAP = "OVERLAP",
  INSUFFICIENT_REST = "INSUFFICIENT_REST",
  OVERTIME = "OVERTIME",
  ON_LEAVE = "ON_LEAVE",
  EMPLOYEE_INACTIVE = "EMPLOYEE_INACTIVE",
  ROLE_MISMATCH = "ROLE_MISMATCH",
  SKILL_MISMATCH = "SKILL_MISMATCH",
  UNAVAILABLE = "UNAVAILABLE",
  AVAILABLE_AFTER_CONFLICT = "AVAILABLE_AFTER_CONFLICT",
  MAX_CONSECUTIVE_SHIFTS = "MAX_CONSECUTIVE_SHIFTS",
  CERTIFICATION_MISSING = "CERTIFICATION_MISSING",
  CERTIFICATION_EXPIRED = "CERTIFICATION_EXPIRED",
  CERTIFICATION_EXPIRING = "CERTIFICATION_EXPIRING",
}

export interface Violation {
  code: ViolationCode;
  level: ViolationLevel;
  message: string;
  meta?: Record<string, string | number>;
}

export interface ValidationResult {
  violations: Violation[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface AssignmentContextItem {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface CandidateAssignment {
  id?: string | null;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  roleId: string | null;
  requiredSkillIds: string[];
}

export interface EmployeeConstraints {
  employeeId: string;
  status: EmployeeStatus;
  roleId: string | null;
  skillIds: string[];
  maxHoursPerWeek: number | null;
  maxConsecutiveShifts: number | null;
  minRestHours: number | null;
}

export interface OrganizationDefaults {
  maxWeeklyHours: number;
  minRestHours: number;
}

export interface LeaveWindow {
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  type: LeaveType;
}

/** A certification held by the employee, as seen by the validation engine. */
export interface CertificationHolding {
  name: string;
  expiresAt: string | null;
}

export interface ValidationContext {
  employee: EmployeeConstraints;
  organizationDefaults: OrganizationDefaults;
  existingAssignments: AssignmentContextItem[];
  availability: AvailabilityDto[];
  leaves: LeaveWindow[];
  /** Certification names the candidate role requires. */
  requiredCertifications?: string[];
  certifications?: CertificationHolding[];
}

function normalizeCertificationName(name: string): string {
  return name.trim().toLowerCase();
}

export interface ScheduleDto {
  id: string;
  organizationId: string;
  weekStartDate: string;
  status: ScheduleStatus;
  version: number;
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAssignmentDto {
  id: string;
  scheduleId: string;
  organizationId: string;
  employeeId: string;
  shiftTemplateId: string;
  roleId: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  status: ShiftAssignmentStatus;
  notes: string | null;
  effectiveStartTime: string;
  effectiveEndTime: string;
  crossesMidnight: boolean;
  durationHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftRequirementDto {
  id: string;
  organizationId: string;
  scheduleId: string;
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftCoverageDto {
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  assignedCount: number;
}

export function toDateOnly(date: Date | string): string {
  if (typeof date === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(date);
    if (match) return match[1];
  }
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error(`Invalid date: ${date}`);
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addDays(date: Date | string, days: number): Date {
  const result = date instanceof Date ? new Date(date.getTime()) : new Date(`${toDateOnly(date)}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfWeek(date: Date | string, weekStartsOn = 1): Date {
  if (weekStartsOn < 0 || weekStartsOn > 6 || !Number.isInteger(weekStartsOn)) {
    throw new Error("weekStartsOn must be an integer from 0 to 6");
  }
  const value = date instanceof Date ? new Date(date.getTime()) : new Date(`${toDateOnly(date)}T00:00:00.000Z`);
  value.setUTCHours(0, 0, 0, 0);
  const distance = (value.getUTCDay() - weekStartsOn + 7) % 7;
  value.setUTCDate(value.getUTCDate() - distance);
  return value;
}

export function weekDates(weekStart: Date | string): string[] {
  const start = startOfWeek(weekStart);
  return Array.from({ length: 7 }, (_, index) => toDateOnly(addDays(start, index)));
}

export function isoWeekNumber(date: Date | string): number {
  const value = new Date(`${toDateOnly(date)}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function shiftInterval(
  date: string,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const start = new Date(`${date}T${startTime}:00.000Z`);
  const end = new Date(`${date}T${endTime}:00.000Z`);
  if (crossesMidnight(startTime, endTime)) end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function intervalsOverlap(
  first: { start: Date; end: Date },
  second: { start: Date; end: Date },
): boolean {
  return first.start < second.end && second.start < first.end;
}

export function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3600000;
}

/** Days before expiry at which an assignment raises a certification warning. */
export const CERTIFICATION_WARNING_DAYS = 30;

export function paidMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  return Math.max(0, shiftDurationMinutes(startTime, endTime) - breakMinutes);
}

export function validateAssignment(
  candidate: CandidateAssignment,
  ctx: ValidationContext,
): ValidationResult {
  const violations: Violation[] = [];
  const addViolation = (
    code: ViolationCode,
    level: ViolationLevel,
    message: string,
    meta?: Record<string, string | number>,
  ): void => {
    violations.push({ code, level, message, ...(meta ? { meta } : {}) });
  };
  const candidateInterval = shiftInterval(candidate.date, candidate.startTime, candidate.endTime);
  const existing = ctx.existingAssignments
    .filter((assignment) => assignment.id !== candidate.id)
    .map((assignment) => ({
      assignment,
      interval: shiftInterval(assignment.date, assignment.startTime, assignment.endTime),
    }));

  if (ctx.employee.status === EmployeeStatus.DISMISSED) {
    addViolation(
      ViolationCode.EMPLOYEE_INACTIVE,
      ViolationLevel.ERROR,
      "The employee is inactive and cannot be assigned a shift",
    );
  }

  const leave = ctx.leaves.find(
    (window) =>
      window.status === LeaveStatus.APPROVED &&
      candidate.date >= toDateOnly(window.startDate) &&
      candidate.date <= toDateOnly(window.endDate),
  );
  if (
    leave ||
    ctx.employee.status === EmployeeStatus.VACATION ||
    ctx.employee.status === EmployeeStatus.SICK
  ) {
    addViolation(
      ViolationCode.ON_LEAVE,
      ViolationLevel.ERROR,
      leave
        ? `The employee is on approved leave on ${candidate.date}`
        : "The employee is currently on leave",
    );
  }

  for (const current of existing) {
    if (current.assignment.employeeId !== candidate.employeeId) continue;
    if (intervalsOverlap(candidateInterval, current.interval)) {
      addViolation(
        ViolationCode.OVERLAP,
        ViolationLevel.ERROR,
        `Overlaps an existing shift on ${current.assignment.date} (${current.assignment.startTime}–${current.assignment.endTime})`,
      );
    }
  }

  const restHours = ctx.employee.minRestHours ?? ctx.organizationDefaults.minRestHours;
  const neighbours = existing
    .filter(({ assignment }) => assignment.employeeId === candidate.employeeId)
    .filter(({ interval }) => !intervalsOverlap(candidateInterval, interval));
  for (const current of neighbours) {
    const gap = current.interval.end <= candidateInterval.start
      ? hoursBetween(current.interval.end, candidateInterval.start)
      : hoursBetween(candidateInterval.end, current.interval.start);
    if (gap < restHours) {
      addViolation(
        ViolationCode.INSUFFICIENT_REST,
        ViolationLevel.ERROR,
        `Only ${gap.toFixed(1)} hours of rest separates this shift from the shift on ${current.assignment.date}`,
        { gapHours: Number(gap.toFixed(2)), requiredHours: restHours },
      );
    }
  }

  const week = new Set(weekDates(startOfWeek(candidate.date)));
  const weeklyMinutes = existing
    .filter(({ assignment }) => assignment.employeeId === candidate.employeeId)
    .filter(({ assignment }) => week.has(toDateOnly(assignment.date)))
    .reduce((total, { assignment }) => total + paidMinutes(assignment.startTime, assignment.endTime, assignment.breakMinutes), 0);
  const totalHours = (weeklyMinutes + paidMinutes(candidate.startTime, candidate.endTime, candidate.breakMinutes)) / 60;
  const weeklyLimit = ctx.employee.maxHoursPerWeek ?? ctx.organizationDefaults.maxWeeklyHours;
  if (totalHours > weeklyLimit) {
    addViolation(
      ViolationCode.OVERTIME,
      ViolationLevel.WARNING,
      `This assignment brings the employee to ${totalHours.toFixed(2)} hours, above the weekly limit of ${weeklyLimit}`,
      { totalHours: Number(totalHours.toFixed(2)), limit: weeklyLimit },
    );
  }

  if (candidate.roleId !== null && ctx.employee.roleId !== candidate.roleId) {
    addViolation(
      ViolationCode.ROLE_MISMATCH,
      ViolationLevel.ERROR,
      "The assignment role does not match the employee's role",
    );
  }

  const missingSkills = candidate.requiredSkillIds.filter(
    (skillId) => !ctx.employee.skillIds.includes(skillId),
  );
  if (missingSkills.length > 0) {
    addViolation(
      ViolationCode.SKILL_MISMATCH,
      ViolationLevel.ERROR,
      `The employee is missing required skills: ${missingSkills.join(", ")}`,
      { missingSkills: missingSkills.join(", ") },
    );
  }

  const availability = ctx.availability.find(
    (entry) => entry.dayOfWeek === new Date(`${candidate.date}T00:00:00.000Z`).getUTCDay(),
  );
  if (availability?.type === AvailabilityType.UNAVAILABLE) {
    addViolation(
      ViolationCode.UNAVAILABLE,
      ViolationLevel.ERROR,
      `The employee is unavailable on ${candidate.date}`,
    );
  } else if (
    availability?.type === AvailabilityType.AVAILABLE_AFTER &&
    availability.availableFrom &&
    timeToMinutes(candidate.startTime) < timeToMinutes(availability.availableFrom)
  ) {
    addViolation(
      ViolationCode.AVAILABLE_AFTER_CONFLICT,
      ViolationLevel.WARNING,
      `The employee is available only after ${availability.availableFrom}`,
      { availableFrom: availability.availableFrom },
    );
  }

  if (ctx.employee.maxConsecutiveShifts !== null) {
    const workedDates = new Set(
      existing
        .filter(({ assignment }) => assignment.employeeId === candidate.employeeId)
        .map(({ assignment }) => toDateOnly(assignment.date)),
    );
    workedDates.add(candidate.date);
    let consecutive = 1;
    let cursor = addDays(candidate.date, -1);
    while (workedDates.has(toDateOnly(cursor))) {
      consecutive += 1;
      cursor = addDays(cursor, -1);
    }
    cursor = addDays(candidate.date, 1);
    while (workedDates.has(toDateOnly(cursor))) {
      consecutive += 1;
      cursor = addDays(cursor, 1);
    }
    if (consecutive > ctx.employee.maxConsecutiveShifts) {
      addViolation(
        ViolationCode.MAX_CONSECUTIVE_SHIFTS,
        ViolationLevel.WARNING,
        `This assignment creates ${consecutive} consecutive working days, above the limit of ${ctx.employee.maxConsecutiveShifts}`,
        { consecutiveShifts: consecutive, limit: ctx.employee.maxConsecutiveShifts },
      );
    }
  }

  for (const required of ctx.requiredCertifications ?? []) {
    const holding = (ctx.certifications ?? []).find(
      (certification) =>
        normalizeCertificationName(certification.name) === normalizeCertificationName(required),
    );
    if (!holding) {
      addViolation(
        ViolationCode.CERTIFICATION_MISSING,
        ViolationLevel.ERROR,
        `The employee is missing the required certification "${required}"`,
        { certification: required },
      );
      continue;
    }
    if (!holding.expiresAt) continue;
    const expiry = toDateOnly(holding.expiresAt);
    if (expiry < candidate.date) {
      addViolation(
        ViolationCode.CERTIFICATION_EXPIRED,
        ViolationLevel.ERROR,
        `The certification "${required}" expired on ${expiry}`,
        { certification: required, expiresAt: expiry },
      );
    } else if (toDateOnly(addDays(candidate.date, CERTIFICATION_WARNING_DAYS)) >= expiry) {
      addViolation(
        ViolationCode.CERTIFICATION_EXPIRING,
        ViolationLevel.WARNING,
        `The certification "${required}" expires on ${expiry}`,
        { certification: required, expiresAt: expiry },
      );
    }
  }

  return {
    violations,
    hasErrors: violations.some((violation) => violation.level === ViolationLevel.ERROR),
    hasWarnings: violations.some((violation) => violation.level === ViolationLevel.WARNING),
  };
}
