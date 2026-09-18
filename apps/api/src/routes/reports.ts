import cors from "cors";
import { Router } from "express";
import { ExportFormat, ReportGranularity, ReportType } from "@shiftflow/shared";
import { createContextForUser, extractUser, requireRole } from "../middleware/auth";
import { reportExportService } from "../services/report-export.service";
import { MembershipRole } from "@prisma/client";

export function createReportsRouter(): Router {
  const router = Router();
  router.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  router.get("/export", async (req, res) => {
    const user = extractUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const query = req.query as Record<string, string | undefined>;
    const organizationId = query.organizationId;
    const type = parseEnum(ReportType, query.type);
    const format = parseEnum(ExportFormat, query.format);
    const from = query.from;
    const to = query.to;
    if (!organizationId || !type || !format || !from || !to) {
      res.status(400).json({ error: "Invalid report parameters" });
      return;
    }
    try {
      const context = createContextForUser(user);
      await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(context, organizationId);
      const granularity = query.granularity ? parseEnum(ReportGranularity, query.granularity) : undefined;
      if (query.granularity && !granularity) {
        res.status(400).json({ error: "Invalid report parameters" });
        return;
      }
      const includeDrafts =
        query.includeDrafts === undefined
          ? false
          : query.includeDrafts === "true"
            ? true
            : query.includeDrafts === "false"
              ? false
              : null;
      if (includeDrafts === null) {
        res.status(400).json({ error: "Invalid report parameters" });
        return;
      }
      const result = await reportExportService.export({
        organizationId,
        type,
        format,
        granularity,
        filters: {
          from,
          to,
          employeeId: query.employeeId,
          departmentId: query.departmentId,
          roleId: query.roleId,
          includeDrafts,
        },
      });
      res
        .status(200)
        .setHeader("Content-Type", result.mimeType)
        .setHeader("Content-Disposition", `attachment; filename="${result.filename}"`)
        .send(result.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid report parameters";
      if (message === "Authentication required" || message.startsWith("Not a member")) {
        res.status(403).json({ error: message });
        return;
      }
      if (message.startsWith("Insufficient permissions")) {
        res.status(403).json({ error: message });
        return;
      }
      res.status(400).json({ error: message });
    }
  });
  return router;
}

function parseEnum<T extends Record<string, string>>(values: T, value: string | undefined): T[keyof T] | undefined {
  if (!value) return undefined;
  return Object.values(values).includes(value as T[keyof T]) ? (value as T[keyof T]) : undefined;
}
