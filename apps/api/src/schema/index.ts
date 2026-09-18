import { builder } from "./builder";

import "./types/user";
import "./types/organization";
import "./types/audit";
import "./types/catalog";

import "./resolvers/auth.resolver";
import "./resolvers/organization.resolver";
import "./resolvers/catalog.resolver";
import "./resolvers/subscription.resolver";

export const schema = builder.toSchema();
