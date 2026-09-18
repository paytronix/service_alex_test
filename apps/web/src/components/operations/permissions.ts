import { MembershipRole, PlanFeature } from "@shiftflow/shared";

function isManager(role?: string | null): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}

/** Managers and owners adjust and approve other people's time entries. */
export function canReviewTimeEntries(role?: string | null): boolean {
  return isManager(role);
}

export function canViewLaborCost(role?: string | null): boolean {
  return isManager(role);
}

/** Payroll exports and pay periods are owner-only. */
export function canManagePayroll(role?: string | null): boolean {
  return role === MembershipRole.OWNER;
}

export function canManageOpenShifts(role?: string | null): boolean {
  return isManager(role);
}

export function canClaimOpenShifts(role?: string | null): boolean {
  return role === MembershipRole.EMPLOYEE || role === MembershipRole.SUPERVISOR;
}

export function canManageIntegrations(role?: string | null): boolean {
  return isManager(role);
}

export function canManageCertifications(role?: string | null): boolean {
  return isManager(role);
}

export function canManageBilling(role?: string | null): boolean {
  return role === MembershipRole.OWNER;
}

export function planHasFeature(
  features: PlanFeature[] | string[] | undefined,
  feature: PlanFeature,
): boolean {
  return (features ?? []).some((item) => item === feature);
}
