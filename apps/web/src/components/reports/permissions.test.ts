import { MembershipRole } from "@shiftflow/shared";
import { describe, expect, it } from "vitest";
import {
  canExportReports,
  canViewDashboardSummary,
  canViewOwnWorkHours,
  canViewReports,
} from "./permissions";

describe("report permissions", () => {
  it("allows report reads for management and supervisors", () => {
    expect(canViewReports(MembershipRole.OWNER)).toBe(true);
    expect(canViewReports(MembershipRole.MANAGER)).toBe(true);
    expect(canViewReports(MembershipRole.SUPERVISOR)).toBe(true);
    expect(canViewReports(MembershipRole.EMPLOYEE)).toBe(false);
  });

  it("restricts exports to owners and managers", () => {
    expect(canExportReports(MembershipRole.OWNER)).toBe(true);
    expect(canExportReports(MembershipRole.MANAGER)).toBe(true);
    expect(canExportReports(MembershipRole.SUPERVISOR)).toBe(false);
    expect(canExportReports(MembershipRole.EMPLOYEE)).toBe(false);
  });

  it("allows dashboard and own-hours access according to role", () => {
    expect(canViewDashboardSummary(MembershipRole.SUPERVISOR)).toBe(true);
    expect(canViewDashboardSummary(MembershipRole.EMPLOYEE)).toBe(false);
    expect(canViewOwnWorkHours(MembershipRole.EMPLOYEE)).toBe(true);
    expect(canViewOwnWorkHours(null)).toBe(false);
  });
});
