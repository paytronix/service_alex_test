import { MembershipRole } from "@shiftflow/shared";

export function canViewReports(role?: string | null): boolean {
  return (
    role === MembershipRole.OWNER ||
    role === MembershipRole.MANAGER ||
    role === MembershipRole.SUPERVISOR
  );
}

export function canExportReports(role?: string | null): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}

export function canViewDashboardSummary(role?: string | null): boolean {
  return canViewReports(role);
}

export function canViewOwnWorkHours(role?: string | null): boolean {
  return (
    role === MembershipRole.OWNER ||
    role === MembershipRole.MANAGER ||
    role === MembershipRole.SUPERVISOR ||
    role === MembershipRole.EMPLOYEE
  );
}
