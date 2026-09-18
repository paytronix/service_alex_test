import {
  AvailabilityType,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  type Availability,
  type Employee,
  type EmployeeSkill,
  type LeaveRequest,
} from "@prisma/client";
import { builder } from "../builder";
import { DepartmentType, RoleType, SkillType } from "./catalog";

export const EmployeeStatusEnum = builder.enumType(EmployeeStatus, { name: "EmployeeStatus" });
export const AvailabilityTypeEnum = builder.enumType(AvailabilityType, {
  name: "AvailabilityType",
});
export const LeaveTypeEnum = builder.enumType(LeaveType, { name: "LeaveType" });
export const LeaveStatusEnum = builder.enumType(LeaveStatus, { name: "LeaveStatus" });

export const EmployeeSkillType = builder.objectRef<EmployeeSkill>("EmployeeSkill");

builder.objectType(EmployeeSkillType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    employeeId: t.exposeString("employeeId"),
    skillId: t.exposeString("skillId"),
    level: t.exposeInt("level"),
    skill: t.field({
      type: SkillType,
      nullable: true,
      resolve: (parent, _args, ctx) => ctx.loaders.skill.load(parent.skillId),
    }),
  }),
});

export const AvailabilityGraphType = builder.objectRef<Availability>("Availability");

builder.objectType(AvailabilityGraphType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    employeeId: t.exposeString("employeeId"),
    dayOfWeek: t.exposeInt("dayOfWeek"),
    type: t.field({ type: AvailabilityTypeEnum, resolve: (parent) => parent.type }),
    availableFrom: t.exposeString("availableFrom", { nullable: true }),
  }),
});

export const LeaveRequestType = builder.objectRef<LeaveRequest>("LeaveRequest");

builder.objectType(LeaveRequestType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    employeeId: t.exposeString("employeeId"),
    organizationId: t.exposeString("organizationId"),
    type: t.field({ type: LeaveTypeEnum, resolve: (parent) => parent.type }),
    status: t.field({ type: LeaveStatusEnum, resolve: (parent) => parent.status }),
    startDate: t.expose("startDate", { type: "DateTime" }),
    endDate: t.expose("endDate", { type: "DateTime" }),
    reason: t.exposeString("reason", { nullable: true }),
    reviewedById: t.exposeString("reviewedById", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const EmployeeType = builder.objectRef<Employee>("Employee");

builder.objectType(EmployeeType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName"),
    fullName: t.string({ resolve: (parent) => `${parent.firstName} ${parent.lastName}` }),
    email: t.exposeString("email"),
    phone: t.exposeString("phone", { nullable: true }),
    photoUrl: t.exposeString("photoUrl", { nullable: true }),
    status: t.field({ type: EmployeeStatusEnum, resolve: (parent) => parent.status }),
    hireDate: t.expose("hireDate", { type: "DateTime", nullable: true }),
    hourlyRate: t.float({
      nullable: true,
      resolve: (parent) => (parent.hourlyRate === null ? null : Number(parent.hourlyRate)),
    }),
    maxHoursPerWeek: t.exposeInt("maxHoursPerWeek", { nullable: true }),
    maxConsecutiveShifts: t.exposeInt("maxConsecutiveShifts", { nullable: true }),
    minRestHours: t.exposeInt("minRestHours", { nullable: true }),
    userId: t.exposeString("userId", { nullable: true }),
    roleId: t.exposeString("roleId", { nullable: true }),
    departmentId: t.exposeString("departmentId", { nullable: true }),
    organizationId: t.exposeString("organizationId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    role: t.field({
      type: RoleType,
      nullable: true,
      resolve: (parent, _args, ctx) =>
        parent.roleId === null ? null : ctx.loaders.role.load(parent.roleId),
    }),
    department: t.field({
      type: DepartmentType,
      nullable: true,
      resolve: (parent, _args, ctx) =>
        parent.departmentId === null ? null : ctx.loaders.department.load(parent.departmentId),
    }),
    skills: t.field({
      type: [EmployeeSkillType],
      resolve: (parent, _args, ctx) => ctx.loaders.employeeSkills.load(parent.id),
    }),
    availability: t.field({
      type: [AvailabilityGraphType],
      resolve: (parent, _args, ctx) => ctx.loaders.employeeAvailability.load(parent.id),
    }),
  }),
});
