import { MembershipRole } from "@shiftflow/shared";

export function canManageSchedule(role?: string | null): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}

export function canAssignShifts(role?: string | null): boolean {
  return (
    role === MembershipRole.OWNER ||
    role === MembershipRole.MANAGER ||
    role === MembershipRole.SUPERVISOR
  );
}
