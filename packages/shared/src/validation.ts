const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,19}$/;

export const DEFAULT_ROLE_COLOR = "#3B82F6";

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function isTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string): number {
  if (!isTimeString(value)) throw new Error(`Invalid time format: ${value}`);
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  return `${String(hours).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

/** A shift crosses midnight when it ends at or before the time it starts (e.g. 23:00–08:00). */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/** Shift duration in minutes, accounting for shifts that continue past midnight. */
export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : 1440 - start + end;
}

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Accepts international formats such as +44 20 7123 4567 or 0701234567. */
export function isPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

export function isDayOfWeek(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/** A leave period is valid when it ends no earlier than it starts. */
export function isValidDateRange(startDate: Date | string, endDate: Date | string): boolean {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return end >= start;
}

/** Inclusive overlap check used to reject conflicting leave periods. */
export function datesOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string,
): boolean {
  return (
    new Date(startA).getTime() <= new Date(endB).getTime() &&
    new Date(startB).getTime() <= new Date(endA).getTime()
  );
}

export function normalizeName(value: string): string {
  return value.trim();
}

export function isNonEmptyName(value: string): boolean {
  return normalizeName(value).length > 0;
}
