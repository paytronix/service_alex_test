import { describe, it, expect, vi, beforeEach } from "vitest";
import { MembershipRole } from "@prisma/client";
import { requireRole, GraphQLContext } from "../src/middleware/auth";

function createMockContext(
  userId: string | null,
  role: MembershipRole | null,
): GraphQLContext {
  return {
    user: userId ? { userId, email: "test@test.com" } : null,
    prisma: {} as GraphQLContext["prisma"],
    getMembership: vi.fn().mockResolvedValue(role ? { role } : null),
  };
}

describe("RBAC middleware", () => {
  it("should allow OWNER access when OWNER required", async () => {
    const ctx = createMockContext("user-1", MembershipRole.OWNER);
    const result = await requireRole(MembershipRole.OWNER)(ctx, "org-1");
    expect(result).toBe(MembershipRole.OWNER);
  });

  it("should deny EMPLOYEE when OWNER required", async () => {
    const ctx = createMockContext("user-1", MembershipRole.EMPLOYEE);
    await expect(requireRole(MembershipRole.OWNER)(ctx, "org-1")).rejects.toThrow(
      "Insufficient permissions",
    );
  });

  it("should allow MANAGER when OWNER or MANAGER required", async () => {
    const ctx = createMockContext("user-1", MembershipRole.MANAGER);
    const result = await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(ctx, "org-1");
    expect(result).toBe(MembershipRole.MANAGER);
  });

  it("should deny unauthenticated users", async () => {
    const ctx = createMockContext(null, null);
    await expect(requireRole(MembershipRole.EMPLOYEE)(ctx, "org-1")).rejects.toThrow(
      "Authentication required",
    );
  });

  it("should deny non-members", async () => {
    const ctx = createMockContext("user-1", null);
    await expect(requireRole(MembershipRole.EMPLOYEE)(ctx, "org-1")).rejects.toThrow(
      "Not a member",
    );
  });

  it("should allow SUPERVISOR when MANAGER or SUPERVISOR required", async () => {
    const ctx = createMockContext("user-1", MembershipRole.SUPERVISOR);
    const result = await requireRole(
      MembershipRole.MANAGER,
      MembershipRole.SUPERVISOR,
    )(ctx, "org-1");
    expect(result).toBe(MembershipRole.SUPERVISOR);
  });

  it("should deny EMPLOYEE when MANAGER or SUPERVISOR required", async () => {
    const ctx = createMockContext("user-1", MembershipRole.EMPLOYEE);
    await expect(
      requireRole(MembershipRole.MANAGER, MembershipRole.SUPERVISOR)(ctx, "org-1"),
    ).rejects.toThrow("Insufficient permissions");
  });
});
