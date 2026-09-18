import { builder } from "./builder";

import "./types/user";
import "./types/organization";
import "./types/audit";
import "./types/catalog";
import "./types/employee";
import "./types/schedule";
import "./types/schedule-history";
import "./types/notification";

import "./resolvers/auth.resolver";
import "./resolvers/organization.resolver";
import "./resolvers/catalog.resolver";
import "./resolvers/employee.resolver";
import "./resolvers/schedule.resolver";
import "./resolvers/schedule-history.resolver";
import "./resolvers/notification.resolver";
import "./resolvers/subscription.resolver";

export const schema = builder.toSchema();
