import {
  isDayOfWeek,
  isEmail,
  isNonEmptyName,
  isPhone,
  isTimeString,
  isValidDateRange,
  normalizeEmail,
  normalizeName,
} from "@shiftflow/shared";

export function assertValidPersonName(label: string, value: string): string {
  if (!isNonEmptyName(value)) throw new Error(`${label} must not be empty`);
  return normalizeName(value);
}

export function assertValidEmail(value: string): string {
  if (!isEmail(value)) throw new Error(`Invalid email: ${value}`);
  return normalizeEmail(value);
}

export function assertValidPhone(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!isPhone(trimmed)) throw new Error(`Invalid phone number: ${value}`);
  return trimmed;
}

export function assertDayOfWeek(value: number): number {
  if (!isDayOfWeek(value)) {
    throw new Error(`Invalid dayOfWeek: ${value}. Expected an integer between 0 (Sunday) and 6`);
  }
  return value;
}

export function assertAvailableFrom(value: string): string {
  if (!isTimeString(value)) {
    throw new Error(`Invalid availableFrom: ${value}. Expected HH:MM in 24-hour format`);
  }
  return value;
}

export function assertDateRange(startDate: Date, endDate: Date): void {
  if (!isValidDateRange(startDate, endDate)) {
    throw new Error("endDate must not be earlier than startDate");
  }
}

export function assertPositiveLimit(label: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

export function isUniqueEmailError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function withUniqueEmail<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueEmailError(error)) {
      throw new Error("Employee with this email already exists in the organization");
    }
    throw error;
  }
}
