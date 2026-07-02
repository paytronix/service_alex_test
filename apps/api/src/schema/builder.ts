import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import ValidationPlugin from "@pothos/plugin-validation";
import type { GraphQLContext } from "../middleware/auth";

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  AuthScopes: {
    authenticated: boolean;
  };
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    JSON: { Input: unknown; Output: unknown };
  };
}>({
  plugins: [ScopeAuthPlugin, ValidationPlugin],
  authScopes: async (ctx) => ({
    authenticated: !!ctx.user,
  }),
});

builder.scalarType("DateTime", {
  serialize: (value) => (value instanceof Date ? value.toISOString() : value),
  parseValue: (value) => {
    if (typeof value === "string" || typeof value === "number") {
      return new Date(value);
    }
    throw new Error("Invalid DateTime value");
  },
});

builder.scalarType("JSON", {
  serialize: (value) => value,
  parseValue: (value) => value,
});

builder.queryType({});
builder.mutationType({});
builder.subscriptionType({});
