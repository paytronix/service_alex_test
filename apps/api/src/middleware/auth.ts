import { Request } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../utils/prisma";
import { MembershipRole } from "@prisma/client";

export interface AuthContext {
  userId: string;
  email: string;
}

export interface GraphQLContext {
  user: AuthContext | null;
  prisma: typeof prisma;
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

export function createContext(req: Request): GraphQLContext {
  const user = extractUser(req);
  return {
    user,
    prisma,
    getMembership: async (organizationId: string) => {
      if (!user) return null;
      return prisma.membership.findUnique({
        where: { userId_organizationId: { userId: user.userId, organizationId } },
        select: { role: true },
      });
    },
  };
}

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
