import { MembershipRole } from "@shiftflow/shared";

export function canViewAuditLog(role?: string | null): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}

export function canViewScheduleHistory(role?: string | null): boolean {
  return (
    role === MembershipRole.OWNER ||
    role === MembershipRole.MANAGER ||
    role === MembershipRole.SUPERVISOR
  );
}
