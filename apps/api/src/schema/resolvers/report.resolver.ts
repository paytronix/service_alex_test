import { MembershipRole } from "@prisma/client";
import {
  addDays,
  ReportGranularity,
  startOfWeek,
  toDateOnly,
} from "@shiftflow/shared";
import { builder } from "../builder";
import {
  DashboardSummaryRef,
  EmployeeWorkloadReportRef,
  ExportFormatEnum,
  ReportExportRef,
  ReportGranularityEnum,
  ReportTypeEnum,
  ScheduleFillRateReportRef,
  WorkHoursReportRef,
} from "../types/report";
import { requireRole, type GraphQLContext } from "../../middleware/auth";
import { analyticsService } from "../../services/analytics.service";
import { reportExportService } from "../../services/report-export.service";

const reportReaders = [MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.SUPERVISOR];

async function requireReportReader(ctx: GraphQLContext, organizationId: string): Promise<MembershipRole> {
  return requireRole(...reportReaders)(ctx, organizationId);
}

async function requireOwnWorkHours(
  ctx: GraphQLContext,
  organizationId: string,
  employeeId: string | null | undefined,
): Promise<string | null> {
  const role = await requireRole(
    MembershipRole.OWNER,
    MembershipRole.MANAGER,
    MembershipRole.SUPERVISOR,
    MembershipRole.EMPLOYEE,
  )(ctx, organizationId);
  if (role !== MembershipRole.EMPLOYEE) return employeeId ?? null;
  const profile = await ctx.prisma.employee.findFirst({
    where: { organizationId, userId: ctx.user?.userId },
    select: { id: true },
  });
  if (!profile) throw new Error("Employee profile not found");
  if (employeeId && employeeId !== profile.id) {
    throw new Error("Employees may only view their own work hours");
  }
  return profile.id;
}

builder.queryField("workHoursReport", (t) =>
  t.field({
    type: WorkHoursReportRef,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      from: t.arg.string({ required: true }),
      to: t.arg.string({ required: true }),
      granularity: t.arg({ type: ReportGranularityEnum }),
      employeeId: t.arg.string(),
      departmentId: t.arg.string(),
      roleId: t.arg.string(),
      locationId: t.arg.string(),
      includeDrafts: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await requireOwnWorkHours(ctx, args.organizationId, args.employeeId);
      return analyticsService.workHours(
        args.organizationId,
        {
          from: args.from,
          to: args.to,
          employeeId,
          departmentId: args.departmentId,
          roleId: args.roleId,
          locationId: args.locationId,
          includeDrafts: args.includeDrafts ?? false,
        },
        args.granularity ?? ReportGranularity.WEEK,
      );
    },
  }),
);

builder.queryField("employeeWorkloadReport", (t) =>
  t.field({
    type: EmployeeWorkloadReportRef,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      from: t.arg.string({ required: true }),
      to: t.arg.string({ required: true }),
      departmentId: t.arg.string(),
      roleId: t.arg.string(),
      locationId: t.arg.string(),
      includeDrafts: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      await requireReportReader(ctx, args.organizationId);
      return analyticsService.employeeWorkload(args.organizationId, {
        from: args.from,
        to: args.to,
        departmentId: args.departmentId,
        roleId: args.roleId,
        locationId: args.locationId,
        includeDrafts: args.includeDrafts ?? false,
      });
    },
  }),
);

builder.queryField("scheduleFillRateReport", (t) =>
  t.field({
    type: ScheduleFillRateReportRef,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      weekStartDate: t.arg.string(),
      from: t.arg.string(),
      to: t.arg.string(),
      locationId: t.arg.string(),
      includeDrafts: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      await requireReportReader(ctx, args.organizationId);
      let from = args.from;
      let to = args.to;
      if (args.weekStartDate) {
        from = toDateOnly(startOfWeek(args.weekStartDate));
        to = toDateOnly(addDays(from, 6));
      }
      if (!from || !to) throw new Error("Either weekStartDate or from/to is required");
      return analyticsService.scheduleFillRate(args.organizationId, {
        from,
        to,
        locationId: args.locationId,
        includeDrafts: args.includeDrafts ?? false,
      });
    },
  }),
);

builder.queryField("dashboardSummary", (t) =>
  t.field({
    type: DashboardSummaryRef,
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await requireReportReader(ctx, args.organizationId);
      return analyticsService.dashboardSummary(args.organizationId);
    },
  }),
);

builder.queryField("exportReport", (t) =>
  t.field({
    type: ReportExportRef,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      type: t.arg({ type: ReportTypeEnum, required: true }),
      format: t.arg({ type: ExportFormatEnum, required: true }),
      from: t.arg.string({ required: false }),
      to: t.arg.string({ required: false }),
      granularity: t.arg({ type: ReportGranularityEnum }),
      employeeId: t.arg.string(),
      departmentId: t.arg.string(),
      roleId: t.arg.string(),
      locationId: t.arg.string(),
      includeDrafts: t.arg.boolean(),
      weekStartDate: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(
        ctx,
        args.organizationId,
      );
      let from = args.from;
      let to = args.to;
      if (args.weekStartDate) {
        from = toDateOnly(startOfWeek(args.weekStartDate));
        to = toDateOnly(addDays(from, 6));
      }
      if (!from || !to) {
        throw new Error("Either weekStartDate or from/to is required");
      }
      const result = await reportExportService.export({
        organizationId: args.organizationId,
        type: args.type,
        format: args.format,
        granularity: args.granularity ?? ReportGranularity.WEEK,
        filters: {
          from,
          to,
          employeeId: args.employeeId,
          departmentId: args.departmentId,
          roleId: args.roleId,
          locationId: args.locationId,
          includeDrafts: args.includeDrafts ?? false,
        },
      });
      return {
        filename: result.filename,
        mimeType: result.mimeType,
        byteSize: result.body.byteLength,
        contentBase64: result.body.toString("base64"),
      };
    },
  }),
);
