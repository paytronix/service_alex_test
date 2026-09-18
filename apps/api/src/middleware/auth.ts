import { Request } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../utils/prisma";
import { MembershipRole } from "@prisma/client";
import { createLoaders, Loaders } from "../utils/loaders";

export interface AuthContext {
  userId: string;
  email: string;
}

export interface GraphQLContext {
  user: AuthContext | null;
  prisma: typeof prisma;
  loaders: Loaders;
  getMembership: (organizationId: string) => Promise<{ role: MembershipRole } | null>;
}

export function extractUser(req: Request): AuthContext | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export function extractUserFromToken(token: string | undefined): AuthContext | null {
  if (!token) return null;
  const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
  try {
    const payload = verifyAccessToken(raw);
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export function createContextForUser(user: AuthContext | null): GraphQLContext {
  return {
    user,
    prisma,
    loaders: createLoaders(),
    getMembership: async (organizationId: string) => {
      if (!user) return null;
      return prisma.membership.findUnique({
        where: { userId_organizationId: { userId: user.userId, organizationId } },
        select: { role: true },
      });
    },
  };
}

export function createContext(req: Request): GraphQLContext {
  return createContextForUser(extractUser(req));
}

/** Any authenticated member of the organization. */
export const requireMember = (ctx: GraphQLContext, organizationId: string) =>
  requireRole(
    MembershipRole.OWNER,
    MembershipRole.MANAGER,
    MembershipRole.SUPERVISOR,
    MembershipRole.EMPLOYEE,
  )(ctx, organizationId);

/** Members allowed to modify organization-wide configuration. */
export const requireManager = (ctx: GraphQLContext, organizationId: string) =>
  requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(ctx, organizationId);

export function requireRole(...roles: MembershipRole[]) {
  return async (
    ctx: GraphQLContext,
    organizationId: string,
  ): Promise<MembershipRole> => {
    if (!ctx.user) throw new Error("Authentication required");
    const membership = await ctx.getMembership(organizationId);
    if (!membership) throw new Error("Not a member of this organization");
    if (!roles.includes(membership.role)) {
      throw new Error(`Insufficient permissions. Required: ${roles.join(", ")}`);
    }
    return membership.role;
  };
}
