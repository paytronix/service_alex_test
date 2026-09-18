import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { MY_ORGANIZATIONS_QUERY, NOTIFICATIONS_COUNT_QUERY } from "../lib/graphql";
import { NotificationList } from "../components/notifications/NotificationList";
import { useNotifications } from "../components/notifications/useNotifications";

const PAGE_SIZE = 20;

interface OrganizationsData {
  myOrganizations: { id: string; name: string; role: string }[];
}

export function NotificationsPage() {
  const [page, setPage] = useState(0);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState("");

  const organizations = useQuery<OrganizationsData>(MY_ORGANIZATIONS_QUERY);
  const organizationId = organizations.data?.myOrganizations[0]?.id ?? null;

  const read = readFilter === "all" ? undefined : readFilter === "read";
  const { items, unreadCount, loading, error, markRead, markAllRead } = useNotifications({
    organizationId,
    read,
    type: typeFilter || undefined,
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const countQuery = useQuery(NOTIFICATIONS_COUNT_QUERY, {
    variables: { organizationId, read, type: typeFilter || undefined },
    skip: !organizationId,
  });
  const total: number = countQuery.data?.notificationsCount ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Notifications</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-gray-600">Status</span>
            <select
              aria-label="Notification status filter"
              value={readFilter}
              onChange={(e) => {
                setReadFilter(e.target.value as "all" | "unread" | "read");
                setPage(0);
              }}
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600">Type</span>
            <select
              aria-label="Notification type filter"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(0);
              }}
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="">All types</option>
              <option value="SHIFT_ASSIGNED">Shift assigned</option>
              <option value="SHIFT_CHANGED">Shift changed</option>
              <option value="REQUEST_APPROVED">Request approved</option>
              <option value="REQUEST_REJECTED">Request rejected</option>
              <option value="SCHEDULE_PUBLISHED">Schedule published</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="rounded bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Mark all read ({unreadCount})
          </button>
        </div>

        <div className="rounded-lg bg-white shadow">
          <NotificationList
            items={items}
            loading={loading}
            error={error}
            onMarkRead={(id) => void markRead(id)}
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </main>
    </div>
  );
}
