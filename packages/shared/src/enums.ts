export enum MembershipRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  SUPERVISOR = "SUPERVISOR",
  EMPLOYEE = "EMPLOYEE",
}

export enum LeaveRequestStatus {
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
