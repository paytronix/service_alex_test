import { MembershipRole } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { generateSlug } from "../utils/slug";
import { v4 as uuid } from "uuid";

interface CreateOrgInput {
  name: string;
  timezone?: string;
  workingDays?: number[];
  shiftStartDefault?: string;
  shiftEndDefault?: string;
  minRestHours?: number;
  maxWeeklyHours?: number;
}

interface InviteInput {
  email: string;
  organizationId: string;
  role?: MembershipRole;
}

export class OrganizationService {
  async create(userId: string, input: CreateOrgInput) {
    let slug = generateSlug(input.name);

    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const org = await prisma.organization.create({
      data: {
        name: input.name,
        slug,
        timezone: input.timezone ?? "UTC",
        workingDays: input.workingDays ?? [1, 2, 3, 4, 5],
        shiftStartDefault: input.shiftStartDefault ?? "09:00",
        shiftEndDefault: input.shiftEndDefault ?? "17:00",
        minRestHours: input.minRestHours ?? 8,
        maxWeeklyHours: input.maxWeeklyHours ?? 40,
      },
    });

    await prisma.membership.create({
      data: {
        userId,
        organizationId: org.id,
        role: MembershipRole.OWNER,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: org.id,
        action: "ORGANIZATION_CREATED",
        entity: "Organization",
        entityId: org.id,
        meta: { name: org.name },
      },
    });

    return org;
  }

  async getById(id: string) {
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw new Error("Organization not found");
    return org;
  }

  async getBySlug(slug: string) {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new Error("Organization not found");
    return org;
  }

  async getUserOrganizations(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
    });
    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }

  async update(orgId: string, data: Partial<CreateOrgInput>) {
    return prisma.organization.update({
      where: { id: orgId },
      data,
    });
  }

  async getMembers(organizationId: string) {
    return prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async updateMemberRole(organizationId: string, userId: string, role: MembershipRole) {
    return prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role },
    });
  }

  async removeMember(organizationId: string, userId: string) {
    return prisma.membership.delete({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }

  async invite(inviterId: string, input: InviteInput) {
    const existingMember = await prisma.membership.findFirst({
      where: {
        organizationId: input.organizationId,
        user: { email: input.email },
      },
    });
    if (existingMember) throw new Error("User is already a member");

    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email: input.email,
        organizationId: input.organizationId,
        accepted: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) throw new Error("Invitation already sent");

    const token = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email: input.email,
        organizationId: input.organizationId,
        role: input.role ?? MembershipRole.EMPLOYEE,
        token,
        expiresAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: inviterId,
        organizationId: input.organizationId,
        action: "INVITATION_SENT",
        entity: "Invitation",
        entityId: invitation.id,
        meta: { email: input.email, role: input.role ?? MembershipRole.EMPLOYEE },
      },
    });

    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new Error("Invalid invitation token");
    if (invitation.accepted) throw new Error("Invitation already accepted");
    if (invitation.expiresAt < new Date()) throw new Error("Invitation expired");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.email !== invitation.email) throw new Error("Invitation email mismatch");

    await prisma.membership.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        action: "INVITATION_ACCEPTED",
        entity: "Invitation",
        entityId: invitation.id,
      },
    });

    return invitation;
  }
}
