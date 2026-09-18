import { ScheduleChangeType, ScheduleVersion, ShiftAssignmentHistory } from "@prisma/client";
import { toDateOnly } from "@shiftflow/shared";
import { builder } from "../builder";
import { UserType } from "./user";
import type { VersionDiffEntry } from "../../services/schedule-history.service";

type UserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
};

export const ScheduleChangeTypeEnum = builder.enumType(ScheduleChangeType, {
  name: "ScheduleChangeType",
});

export const ScheduleVersionRef = builder.objectRef<
  ScheduleVersion & { publishedBy?: UserSummary | null }
>("ScheduleVersion");

builder.objectType(ScheduleVersionRef, {
  fields: (t) => ({
    id: t.exposeString("id"),
    scheduleId: t.exposeString("scheduleId"),
    version: t.exposeInt("version"),
    publishedAt: t.expose("publishedAt", { type: "DateTime" }),
    publishedById: t.exposeString("publishedById", { nullable: true }),
    snapshot: t.expose("snapshot", { type: "JSON", nullable: true }),
    publishedBy: t.field({
      type: UserType,
      nullable: true,
      resolve: (parent) => parent.publishedBy ?? null,
    }),
  }),
});

export const ShiftAssignmentHistoryRef = builder.objectRef<
  ShiftAssignmentHistory & { changedBy?: UserSummary | null }
>("ShiftAssignmentHistory");

builder.objectType(ShiftAssignmentHistoryRef, {
  fields: (t) => ({
    id: t.exposeString("id"),
    scheduleId: t.exposeString("scheduleId"),
    assignmentId: t.exposeString("assignmentId"),
    changeType: t.expose("changeType", { type: ScheduleChangeTypeEnum }),
    date: t.string({ resolve: (parent) => toDateOnly(parent.date) }),
    previousEmployeeId: t.exposeString("previousEmployeeId", { nullable: true }),
    newEmployeeId: t.exposeString("newEmployeeId", { nullable: true }),
    metadata: t.expose("metadata", { type: "JSON", nullable: true }),
    changedAt: t.expose("changedAt", { type: "DateTime" }),
    changedBy: t.field({
      type: UserType,
      nullable: true,
      resolve: (parent) => parent.changedBy ?? null,
    }),
  }),
});

export const ScheduleVersionDiffEntryRef =
  builder.objectRef<VersionDiffEntry>("ScheduleVersionDiffEntry");

builder.objectType(ScheduleVersionDiffEntryRef, {
  fields: (t) => ({
    assignmentId: t.exposeString("assignmentId"),
    changeType: t.expose("changeType", { type: ScheduleChangeTypeEnum }),
    date: t.exposeString("date"),
    previousEmployeeId: t.exposeString("previousEmployeeId", { nullable: true }),
    newEmployeeId: t.exposeString("newEmployeeId", { nullable: true }),
  }),
});
