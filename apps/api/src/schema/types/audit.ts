import { builder } from "../builder";
import { UserType } from "./user";

export const AuditLogType = builder.objectRef<{
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
  user?: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean } | null;
}>("AuditLog");

builder.objectType(AuditLogType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    action: t.exposeString("action"),
    entity: t.exposeString("entity"),
    entityId: t.exposeString("entityId", { nullable: true }),
    meta: t.expose("meta", { type: "JSON", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    user: t.field({
      type: UserType,
      nullable: true,
      resolve: (parent) => parent.user ?? null,
    }),
  }),
});
