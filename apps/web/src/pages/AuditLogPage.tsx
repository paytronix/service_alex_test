import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import {
  AUDIT_LOGS_COUNT_QUERY,
  AUDIT_LOGS_QUERY,
  MY_ORGANIZATIONS_QUERY,
} from "../lib/graphql";
import {
  AuditLogTable,
  type AuditLogFilters,
} from "../components/notifications/AuditLogTable";
import { canViewAuditLog } from "../components/notifications/permissions";
import type { AuditLogItem } from "../components/notifications/types";

const PAGE_SIZE = 25;

interface OrganizationsData {
  myOrganizations: { id: string; name: string; role: string }[];
}

function toDateTime(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: "",
    entity: "",
    actorId: "",
    from: "",
    to: "",
  });

  const organizations = useQuery<OrganizationsData>(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations[0];
  const organizationId = organization?.id ?? null;
  const allowed = canViewAuditLog(organization?.role);

  const filterVariables = {
    organizationId,
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    actorId: filters.actorId || undefined,
    from: toDateTime(filters.from),
    to: toDateTime(filters.to),
  };

  const { data, loading, error } = useQuery(AUDIT_LOGS_QUERY, {
    variables: { ...filterVariables, skip: page * PAGE_SIZE, take: PAGE_SIZE },
    skip: !organizationId || !allowed,
  });
  const countQuery = useQuery(AUDIT_LOGS_COUNT_QUERY, {
    variables: filterVariables,
    skip: !organizationId || !allowed,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Audit log</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!allowed ? (
          <p className="text-sm text-gray-600">
            You do not have permission to view the audit log.
          </p>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow">
            <AuditLogTable
              items={(data?.auditLogs ?? []) as AuditLogItem[]}
              loading={loading}
              error={error?.message ?? null}
              filters={filters}
              onFiltersChange={(next) => {
                setFilters(next);
                setPage(0);
              }}
              page={page}
              pageSize={PAGE_SIZE}
              total={(countQuery.data?.auditLogsCount ?? 0) as number}
              onPageChange={setPage}
            />
          </div>
        )}
      </main>
    </div>
  );
}
