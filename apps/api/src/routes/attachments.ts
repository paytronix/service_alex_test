import cors from "cors";
import { Router } from "express";
import multer from "multer";
import { AttachmentEntityType, MembershipRole } from "@prisma/client";
import { ATTACHMENT_MAX_SIZE_BYTES, isAllowedAttachmentMimeType } from "@shiftflow/shared";
import { createContextForUser, extractUser, requireMember, requireRole } from "../middleware/auth";
import { attachmentService } from "../services/attachment.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedAttachmentMimeType(file.mimetype)) {
      callback(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
});

function parseEntityType(value: string | undefined): AttachmentEntityType | null {
  if (!value) return null;
  return Object.values(AttachmentEntityType).includes(value as AttachmentEntityType)
    ? (value as AttachmentEntityType)
    : null;
}

export function createAttachmentsRouter(): Router {
  const router = Router();
  router.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );

  router.post("/", upload.single("file"), async (req, res) => {
    const user = extractUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = req.body as Record<string, string | undefined>;
    const organizationId = body.organizationId;
    const entityType = parseEntityType(body.entityType);
    const entityId = body.entityId;
    if (!organizationId || !entityType || !entityId || !req.file) {
      res.status(400).json({ error: "organizationId, entityType, entityId and file are required" });
      return;
    }
    try {
      const context = createContextForUser(user);
      await requireRole(
        MembershipRole.OWNER,
        MembershipRole.MANAGER,
        MembershipRole.SUPERVISOR,
      )(context, organizationId);
      const attachment = await attachmentService.upload(organizationId, user.userId, {
        entityType,
        entityId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        content: req.file.buffer,
      });
      res.status(201).json(attachment);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.get("/:id", async (req, res) => {
    const user = extractUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const organizationId = (req.query.organizationId as string | undefined) ?? undefined;
    if (!organizationId) {
      res.status(400).json({ error: "organizationId is required" });
      return;
    }
    try {
      const context = createContextForUser(user);
      await requireMember(context, organizationId);
      const { attachment, stream } = await attachmentService.openStream(organizationId, req.params.id);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName}"`);
      stream.on("error", () => res.status(404).end());
      stream.pipe(res);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return router;
}
