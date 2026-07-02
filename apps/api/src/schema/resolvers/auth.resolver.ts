import { builder } from "../builder";
import { AuthResultType, AuthTokensType, UserType } from "../types/user";
import { AuthService } from "../../services/auth.service";

const authService = new AuthService();

builder.queryField("me", (t) =>
  t.field({
    type: UserType,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      return authService.me(ctx.user.userId);
    },
  }),
);

builder.mutationField("register", (t) =>
  t.field({
    type: AuthResultType,
    args: {
      email: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
      firstName: t.arg.string({ required: true }),
      lastName: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return authService.register({
        email: args.email,
        password: args.password,
        firstName: args.firstName,
        lastName: args.lastName,
      });
    },
  }),
);

builder.mutationField("login", (t) =>
  t.field({
    type: AuthResultType,
    args: {
      email: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return authService.login(args.email, args.password);
    },
  }),
);

builder.mutationField("refreshTokens", (t) =>
  t.field({
    type: AuthTokensType,
    args: {
      refreshToken: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return authService.refreshTokens(args.refreshToken);
    },
  }),
);

builder.mutationField("verifyEmail", (t) =>
  t.field({
    type: "Boolean",
    args: {
      token: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return authService.verifyEmail(args.token);
    },
  }),
);

builder.mutationField("requestPasswordReset", (t) =>
  t.field({
    type: "Boolean",
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return authService.requestPasswordReset(args.email);
    },
  }),
);

builder.mutationField("resetPassword", (t) =>
  t.field({
    type: "Boolean",
    args: {
      token: t.arg.string({ required: true }),
      newPassword: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return authService.resetPassword(args.token, args.newPassword);
    },
  }),
);
