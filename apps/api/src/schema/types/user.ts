import { builder } from "../builder";

export const UserType = builder.objectRef<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  createdAt?: Date;
}>("User");

builder.objectType(UserType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    email: t.exposeString("email"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName"),
    emailVerified: t.exposeBoolean("emailVerified"),
    avatarUrl: t.exposeString("avatarUrl", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime", nullable: true }),
  }),
});

export const AuthTokensType = builder.objectRef<{
  accessToken: string;
  refreshToken: string;
}>("AuthTokens");

builder.objectType(AuthTokensType, {
  fields: (t) => ({
    accessToken: t.exposeString("accessToken"),
    refreshToken: t.exposeString("refreshToken"),
  }),
});

export const AuthResultType = builder.objectRef<{
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  };
  tokens: { accessToken: string; refreshToken: string };
}>("AuthResult");

builder.objectType(AuthResultType, {
  fields: (t) => ({
    user: t.field({
      type: UserType,
      resolve: (parent) => parent.user,
    }),
    tokens: t.field({
      type: AuthTokensType,
      resolve: (parent) => parent.tokens,
    }),
  }),
});
