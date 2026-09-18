import cors from "cors";
import { Router } from "express";
import multer from "multer";
import { EmployeeDocumentType, MembershipRole } from "@prisma/client";
import { ATTACHMENT_MAX_SIZE_BYTES, isAllowedAttachmentMimeType } from "@shiftflow/shared";
import { createContextForUser, extractUser, requireMember, requireRole } from "../middleware/auth";
import { employeeDocumentService } from "../services/employee-document.service";

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

function parseDocumentType(value: string | undefined): EmployeeDocumentType {
  return value && Object.values(EmployeeDocumentType).includes(value as EmployeeDocumentType)
    ? (value as EmployeeDocumentType)
    : EmployeeDocumentType.OTHER;
}

/** Multipart upload of onboarding documents: `POST /api/employee-documents`. */
export function createEmployeeDocumentsRouter(): Router {
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
    const { organizationId, employeeId } = body;
    if (!organizationId || !employeeId || !req.file) {
      res.status(400).json({ error: "organizationId, employeeId and file are required" });
      return;
    }
    try {
      const context = createContextForUser(user);
      await requireMember(context, organizationId);
      // Employees may upload only to their own card; managers to anyone's.
      try {
        await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(context, organizationId);
      } catch {
        const employee = await context.prisma.employee.findFirst({
          where: { id: employeeId, organizationId },
          select: { userId: true },
        });
        if (employee?.userId !== user.userId) {
          res.status(403).json({ error: "You can only upload your own documents" });
          return;
        }
      }
      const document = await employeeDocumentService.upload(organizationId, user.userId, {
        employeeId,
        type: parseDocumentType(body.type),
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        content: req.file.buffer,
      });
      res.status(201).json(document);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return router;
}
