import { createReadStream } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { AttachmentEntityType } from "@prisma/client";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  isAllowedAttachmentMimeType,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";

export interface UploadAttachmentInput {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  size: number;
  content: Buffer;
}

const auditService = new AuditService();

function storageRoot(): string {
  return process.env.ATTACHMENT_STORAGE_DIR || path.resolve(process.cwd(), "storage/attachments");
}

function safeFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "file";
}

export class AttachmentService {
  async list(organizationId: string, entityType: AttachmentEntityType, entityId: string) {
    return prisma.attachment.findMany({
      where: { organizationId, entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const attachment = await prisma.attachment.findFirst({ where: { id, organizationId } });
    if (!attachment) throw new Error("Attachment not found");
    return attachment;
  }

  async upload(organizationId: string, userId: string, input: UploadAttachmentInput) {
    if (input.size > ATTACHMENT_MAX_SIZE_BYTES) {
      throw new Error(`File exceeds the ${ATTACHMENT_MAX_SIZE_BYTES} byte limit`);
    }
    if (!isAllowedAttachmentMimeType(input.mimeType)) {
      throw new Error(`Unsupported file type: ${input.mimeType}`);
    }
    await this.assertEntityExists(organizationId, input.entityType, input.entityId);

    const fileName = safeFileName(input.fileName);
    const directory = path.join(storageRoot(), organizationId);
    await mkdir(directory, { recursive: true });
    const storageKey = path.join(organizationId, `${Date.now()}-${fileName}`);
    await writeFile(path.join(storageRoot(), storageKey), input.content);

    const attachment = await prisma.attachment.create({
      data: {
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName,
        storageKey,
        mimeType: input.mimeType,
        size: input.size,
        uploadedById: userId,
      },
    });
    const withUrl = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { url: `/api/attachments/${attachment.id}` },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "ATTACHMENT_UPLOADED",
      entity: "Attachment",
      entityId: attachment.id,
      meta: {
        entityType: input.entityType,
        entityId: input.entityId,
        fileName,
        size: input.size,
      },
    });
    return withUrl;
  }

  /** Read stream for the stored file, used by the download endpoint. */
  async openStream(organizationId: string, id: string) {
    const attachment = await this.getById(organizationId, id);
    return {
      attachment,
      stream: createReadStream(path.join(storageRoot(), attachment.storageKey)),
    };
  }

  async delete(organizationId: string, userId: string, id: string) {
    const attachment = await this.getById(organizationId, id);
    await prisma.attachment.delete({ where: { id } });
    await unlink(path.join(storageRoot(), attachment.storageKey)).catch(() => undefined);
    await auditService.log({
      userId,
      organizationId,
      action: "ATTACHMENT_DELETED",
      entity: "Attachment",
      entityId: id,
      meta: { fileName: attachment.fileName },
    });
    return true;
  }

  private async assertEntityExists(
    organizationId: string,
    entityType: AttachmentEntityType,
    entityId: string,
  ) {
    const exists =
      entityType === AttachmentEntityType.SHIFT_ASSIGNMENT
        ? await prisma.shiftAssignment.findFirst({ where: { id: entityId, organizationId } })
        : entityType === AttachmentEntityType.SCHEDULE
          ? await prisma.schedule.findFirst({ where: { id: entityId, organizationId } })
          : await prisma.employee.findFirst({ where: { id: entityId, organizationId } });
    if (!exists) throw new Error(`${entityType} not found in this organization`);
  }
}

export const attachmentService = new AttachmentService();
