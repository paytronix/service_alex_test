export interface BusinessRules {
  maxWeeklyHours: number;
  minRestBetweenShiftsHours: number;
  noOverlappingShifts: boolean;
  requireSkillMatch: boolean;
  requireRoleMatch: boolean;
  respectAvailability: boolean;
  respectLeaveRequests: boolean;
  scheduleRequiresDraft: boolean;
}
