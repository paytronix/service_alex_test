import { MembershipRole } from "@shiftflow/shared";

/** Only Owners and Managers may modify catalog entities. */
export function canManageCatalogs(role?: string | null): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}
