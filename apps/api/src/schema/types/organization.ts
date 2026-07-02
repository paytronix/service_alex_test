import { builder } from "../builder";
import { MembershipRole as PrismaMembershipRole } from "@prisma/client";

export const MembershipRoleEnum = builder.enumType("MembershipRole", {
  values: ["OWNER", "MANAGER", "SUPERVISOR", "EMPLOYEE"] as const,
});

export const OrganizationType = builder.objectRef<{
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  timezone: string;
  workingDays: number[];
  shiftStartDefault: string;
  shiftEndDefault: string;
  minRestHours: number;
  maxWeeklyHours: number;
  notifyByEmail: boolean;
  notifyInApp: boolean;
  createdAt: Date;
  role?: PrismaMembershipRole;
}>("Organization");

builder.objectType(OrganizationType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    logoUrl: t.exposeString("logoUrl", { nullable: true }),
    timezone: t.exposeString("timezone"),
    workingDays: t.exposeIntList("workingDays"),
    shiftStartDefault: t.exposeString("shiftStartDefault"),
    shiftEndDefault: t.exposeString("shiftEndDefault"),
    minRestHours: t.exposeInt("minRestHours"),
    maxWeeklyHours: t.exposeInt("maxWeeklyHours"),
    notifyByEmail: t.exposeBoolean("notifyByEmail"),
    notifyInApp: t.exposeBoolean("notifyInApp"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    role: t.field({
      type: MembershipRoleEnum,
      nullable: true,
      resolve: (parent) => parent.role ?? null,
    }),
  }),
});

export const MemberType = builder.objectRef<{
  id: string;
  userId: string;
  organizationId: string;
  role: PrismaMembershipRole;
  createdAt: Date;
  user: { id: string; email: string; firstName: string; lastName: string };
}>("Member");

builder.objectType(MemberType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    userId: t.exposeString("userId"),
    organizationId: t.exposeString("organizationId"),
    role: t.field({ type: MembershipRoleEnum, resolve: (p) => p.role }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    userEmail: t.string({ resolve: (p) => p.user.email }),
    userFirstName: t.string({ resolve: (p) => p.user.firstName }),
    userLastName: t.string({ resolve: (p) => p.user.lastName }),
  }),
});

export const InvitationType = builder.objectRef<{
  id: string;
  email: string;
  organizationId: string;
  role: PrismaMembershipRole;
  token: string;
  accepted: boolean;
  expiresAt: Date;
  createdAt: Date;
}>("Invitation");

builder.objectType(InvitationType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    email: t.exposeString("email"),
    organizationId: t.exposeString("organizationId"),
    role: t.field({ type: MembershipRoleEnum, resolve: (p) => p.role }),
    accepted: t.exposeBoolean("accepted"),
    expiresAt: t.expose("expiresAt", { type: "DateTime" }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});
