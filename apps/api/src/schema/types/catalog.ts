import type { Department, Role, Skill, ShiftTemplate } from "@prisma/client";
import { builder } from "../builder";

export const DepartmentType = builder.objectRef<Department>("Department");

builder.objectType(DepartmentType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    organizationId: t.exposeString("organizationId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const RoleType = builder.objectRef<Role>("Role");

builder.objectType(RoleType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    color: t.exposeString("color"),
    description: t.exposeString("description", { nullable: true }),
    maxLoad: t.exposeInt("maxLoad", { nullable: true }),
    hourlyRate: t.float({
      nullable: true,
      resolve: (parent) => (parent.hourlyRate === null ? null : Number(parent.hourlyRate)),
    }),
    organizationId: t.exposeString("organizationId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const SkillType = builder.objectRef<Skill>("Skill");

builder.objectType(SkillType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    organizationId: t.exposeString("organizationId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const ShiftTemplateType = builder.objectRef<ShiftTemplate>("ShiftTemplate");

builder.objectType(ShiftTemplateType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    startTime: t.exposeString("startTime"),
    endTime: t.exposeString("endTime"),
    crossesMidnight: t.exposeBoolean("crossesMidnight"),
    breakMinutes: t.exposeInt("breakMinutes"),
    minEmployees: t.exposeInt("minEmployees"),
    maxEmployees: t.exposeInt("maxEmployees"),
    roleId: t.exposeString("roleId", { nullable: true }),
    color: t.exposeString("color", { nullable: true }),
    organizationId: t.exposeString("organizationId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});
