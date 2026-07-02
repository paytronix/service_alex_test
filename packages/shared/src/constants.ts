import type { BusinessRules } from "./types";

export const BUSINESS_RULES: BusinessRules = {
  maxWeeklyHours: 40,
  minRestBetweenShiftsHours: 8,
  noOverlappingShifts: true,
  requireSkillMatch: true,
  requireRoleMatch: true,
  respectAvailability: true,
  respectLeaveRequests: true,
  scheduleRequiresDraft: true,
};
