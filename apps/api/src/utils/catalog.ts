import { isHexColor, isNonEmptyName, isTimeString, normalizeName } from "@shiftflow/shared";

export function assertValidName(name: string): string {
  if (!isNonEmptyName(name)) throw new Error("Name must not be empty");
  return normalizeName(name);
}

export function assertValidColor(color: string): string {
  if (!isHexColor(color)) {
    throw new Error(`Invalid color: ${color}. Expected a hex color such as #3B82F6`);
  }
  return color.toUpperCase();
}

export function assertValidTime(label: string, time: string): string {
  if (!isTimeString(time)) {
    throw new Error(`Invalid ${label}: ${time}. Expected HH:MM in 24-hour format`);
  }
  return time;
}

export function assertPositive(label: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return value;
}

export function assertNonNegative(label: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must not be negative`);
  }
  return value;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function withUniqueName<T>(entity: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(`${entity} with this name already exists in the organization`);
    }
    throw error;
  }
}
