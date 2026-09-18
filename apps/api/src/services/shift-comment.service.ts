import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";

export interface CreateCommentInput {
  assignmentId?: string | null;
  scheduleId?: string | null;
  text: string;
}

const auditService = new AuditService();

export class ShiftCommentService {
  async list(
    organizationId: string,
    filter: { assignmentId?: string | null; scheduleId?: string | null },
  ) {
    if (!filter.assignmentId && !filter.scheduleId) {
      throw new Error("Either assignmentId or scheduleId must be provided");
    }
    return prisma.shiftComment.findMany({
      where: {
        organizationId,
        ...(filter.assignmentId ? { assignmentId: filter.assignmentId } : {}),
        ...(filter.scheduleId ? { scheduleId: filter.scheduleId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const comment = await prisma.shiftComment.findFirst({ where: { id, organizationId } });
    if (!comment) throw new Error("Shift comment not found");
    return comment;
  }

  async create(organizationId: string, userId: string, input: CreateCommentInput) {
    const text = input.text.trim();
    if (!text) throw new Error("Comment text must not be empty");
    if (!input.assignmentId && !input.scheduleId) {
      throw new Error("Either assignmentId or scheduleId must be provided");
    }
    const assignment = input.assignmentId
      ? await prisma.shiftAssignment.findFirst({
          where: { id: input.assignmentId, organizationId },
          select: { id: true, scheduleId: true, employeeId: true },
        })
      : null;
    if (input.assignmentId && !assignment) throw new Error("Shift assignment not found");
    if (input.scheduleId) {
      const schedule = await prisma.schedule.findFirst({
        where: { id: input.scheduleId, organizationId },
        select: { id: true },
      });
      if (!schedule) throw new Error("Schedule not found");
    }

    const comment = await prisma.shiftComment.create({
      data: {
        organizationId,
        assignmentId: assignment?.id ?? null,
        scheduleId: input.scheduleId ?? assignment?.scheduleId ?? null,
        authorId: userId,
        text,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_COMMENT_CREATED",
      entity: "ShiftComment",
      entityId: comment.id,
      meta: { assignmentId: comment.assignmentId, scheduleId: comment.scheduleId },
    });
    eventBus.emit("shiftComment.added", {
      organizationId,
      actorId: userId,
      commentId: comment.id,
      assignmentId: comment.assignmentId,
      scheduleId: comment.scheduleId,
      text: comment.text,
      recipientEmployeeIds: assignment ? [assignment.employeeId] : [],
    });
    return comment;
  }

  async update(organizationId: string, userId: string, id: string, text: string) {
    const comment = await this.getById(organizationId, id);
    if (comment.authorId !== userId) throw new Error("Only the author can edit a comment");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Comment text must not be empty");
    return prisma.shiftComment.update({ where: { id }, data: { text: trimmed } });
  }

  /** Authors may delete their own comments; managers may delete any comment. */
  async delete(organizationId: string, userId: string, id: string, canModerate: boolean) {
    const comment = await this.getById(organizationId, id);
    if (comment.authorId !== userId && !canModerate) {
      throw new Error("Only the author or a manager can delete a comment");
    }
    await prisma.shiftComment.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_COMMENT_DELETED",
      entity: "ShiftComment",
      entityId: id,
    });
    return true;
  }
}

export const shiftCommentService = new ShiftCommentService();
