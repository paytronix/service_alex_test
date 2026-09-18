export enum MembershipRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  SUPERVISOR = "SUPERVISOR",
  EMPLOYEE = "EMPLOYEE",
}

export enum EmployeeStatus {
  WORKING = "WORKING",
  VACATION = "VACATION",
  SICK = "SICK",
  DISMISSED = "DISMISSED",
}

export enum AvailabilityType {
  UNAVAILABLE = "UNAVAILABLE",
  AVAILABLE = "AVAILABLE",
  AVAILABLE_AFTER = "AVAILABLE_AFTER",
}

export enum LeaveType {
  VACATION = "VACATION",
  DAY_OFF = "DAY_OFF",
  SICK = "SICK",
  UNPAID = "UNPAID",
  OTHER = "OTHER",
}

export enum LeaveStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum ShiftAssignmentStatus {
  ASSIGNED = "ASSIGNED",
  CONFIRMED = "CONFIRMED",
  DECLINED = "DECLINED",
  SWAPPED = "SWAPPED",
  NO_SHOW = "NO_SHOW",
  COMPLETED = "COMPLETED",
}

export enum ScheduleStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}
