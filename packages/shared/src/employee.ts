import type { AvailabilityType, EmployeeStatus, LeaveStatus, LeaveType } from "./enums";

export interface EmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  hireDate: string | null;
  status: EmployeeStatus;
  maxHoursPerWeek: number | null;
  maxConsecutiveShifts: number | null;
  minRestHours: number | null;
  roleId: string | null;
  departmentId: string | null;
  userId: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSkillDto {
  id: string;
  employeeId: string;
  skillId: string;
  level: number;
}

export interface AvailabilityDto {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  type: AvailabilityType;
  availableFrom: string | null;
}

export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  organizationId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
