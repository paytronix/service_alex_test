import { MembershipRole } from "@shiftflow/shared";

/** Only Owners and Managers may create, edit or dismiss employees. */
export function canManageEmployees(role?: string | null): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}

/** Only Owners and Managers may approve or reject leave requests. */
export function canReviewLeaveRequests(role?: string | null): boolean {
  return canManageEmployees(role);
}
