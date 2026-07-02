import { builder } from "./builder";

import "./types/user";
import "./types/organization";
import "./types/audit";

import "./resolvers/auth.resolver";
import "./resolvers/organization.resolver";
import "./resolvers/subscription.resolver";

export const schema = builder.toSchema();
