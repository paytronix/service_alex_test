import { AttachmentEntityType, EmployeeDocumentType } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";
import { attachmentService } from "./attachment.service";

export interface UploadEmployeeDocumentInput {
  employeeId: string;
  type: EmployeeDocumentType;
  fileName: string;
  mimeType: string;
  size: number;
  content: Buffer;
}

const auditService = new AuditService();

/** Employee onboarding documents, stored through the Epic 9 attachment pipeline. */
export class EmployeeDocumentService {
  async list(organizationId: string, employeeId?: string | null) {
    return prisma.employeeDocument.findMany({
      where: { organizationId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const document = await prisma.employeeDocument.findFirst({ where: { id, organizationId } });
    if (!document) throw new Error("Employee document not found");
    return document;
  }

  async upload(organizationId: string, userId: string, input: UploadEmployeeDocumentInput) {
    const attachment = await attachmentService.upload(organizationId, userId, {
      entityType: AttachmentEntityType.EMPLOYEE_DOCUMENT,
      entityId: input.employeeId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      content: input.content,
    });
    const document = await prisma.employeeDocument.create({
      data: {
        organizationId,
        employeeId: input.employeeId,
        type: input.type,
        fileName: attachment.fileName,
        storageKey: attachment.storageKey,
        url: attachment.url,
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedById: userId,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_DOCUMENT_UPLOADED",
      entity: "EmployeeDocument",
      entityId: document.id,
      meta: { employeeId: input.employeeId, type: input.type, fileName: attachment.fileName },
    });
    return document;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const document = await this.getById(organizationId, id);
    await prisma.employeeDocument.delete({ where: { id } });
    const attachment = await prisma.attachment.findFirst({
      where: { organizationId, storageKey: document.storageKey },
    });
    if (attachment) await attachmentService.delete(organizationId, userId, attachment.id);
    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_DOCUMENT_DELETED",
      entity: "EmployeeDocument",
      entityId: id,
      meta: { employeeId: document.employeeId, fileName: document.fileName },
    });
    return true;
  }
}

export const employeeDocumentService = new EmployeeDocumentService();
