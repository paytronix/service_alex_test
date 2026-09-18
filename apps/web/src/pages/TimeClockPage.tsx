import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import { TimeEntrySource } from "@shiftflow/shared";
import {
  ADJUST_TIME_ENTRY_MUTATION,
  APPROVE_TIME_ENTRY_MUTATION,
  CLOCK_IN_MUTATION,
  CLOCK_OUT_MUTATION,
  EMPLOYEES_QUERY,
  MY_EMPLOYEE_PROFILE_QUERY,
  MY_ORGANIZATIONS_QUERY,
  OPEN_TIME_ENTRY_QUERY,
  TIMESHEET_QUERY,
} from "../lib/graphql";
import { canReviewTimeEntries } from "../components/operations/permissions";
import { ClockPanel } from "../components/operations/ClockPanel";
import { TimesheetTable, type TimesheetData } from "../components/operations/TimesheetTable";

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const to = new Date(from.getTime() + 6 * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function TimeClockPage() {
  const organizations = useQuery(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations?.[0];
  const organizationId: string | undefined = organization?.id;
  const role: string | undefined = organization?.role;
  const canReview = canReviewTimeEntries(role);

  const [range, setRange] = useState(weekRange);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery(MY_EMPLOYEE_PROFILE_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const myEmployeeId: string | undefined = profile.data?.myEmployeeProfile?.id;

  const employees = useQuery(EMPLOYEES_QUERY, {
    variables: { organizationId },
    skip: !organizationId || !canReview,
  });

  const openEntry = useQuery(OPEN_TIME_ENTRY_QUERY, {
    variables: { organizationId, employeeId: myEmployeeId },
    skip: !organizationId || !myEmployeeId,
    fetchPolicy: "cache-and-network",
  });

  const timesheetVariables = useMemo(
    () => ({
      organizationId,
      from: range.from,
      to: range.to,
      ...(canReview && employeeId ? { employeeId } : {}),
    }),
    [canReview, employeeId, organizationId, range.from, range.to],
  );
  const timesheet = useQuery<{ timesheet: TimesheetData }>(TIMESHEET_QUERY, {
    variables: timesheetVariables,
    skip: !organizationId,
  });

  const refetchQueries = useMemo(
    () => [
      { query: TIMESHEET_QUERY, variables: timesheetVariables },
      ...(myEmployeeId
        ? [{ query: OPEN_TIME_ENTRY_QUERY, variables: { organizationId, employeeId: myEmployeeId } }]
        : []),
    ],
    [myEmployeeId, organizationId, timesheetVariables],
  );

  const [clockIn] = useMutation(CLOCK_IN_MUTATION, { refetchQueries });
  const [clockOut] = useMutation(CLOCK_OUT_MUTATION, { refetchQueries });
  const [adjustEntry] = useMutation(ADJUST_TIME_ENTRY_MUTATION, { refetchQueries });
  const [approveEntry] = useMutation(APPROVE_TIME_ENTRY_MUTATION, { refetchQueries });

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Time clock</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {organizations.loading ? (
          <p className="text-gray-500">Loading organizations...</p>
        ) : !organizationId ? (
          <p className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">
            Create an organization first.
          </p>
        ) : (
          <>
            {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            {myEmployeeId && (
              <ClockPanel
                entry={openEntry.data?.openTimeEntry ?? null}
                loading={openEntry.loading}
                onClockIn={(source: TimeEntrySource) =>
                  run(() =>
                    clockIn({ variables: { organizationId, employeeId: myEmployeeId, source } }),
                  )
                }
                onClockOut={(note) =>
                  run(() =>
                    clockOut({
                      variables: { organizationId, employeeId: myEmployeeId, note: note || null },
                    }),
                  )
                }
              />
            )}

            <section className="rounded-lg bg-white p-4 shadow">
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm text-gray-600">
                  From
                  <input
                    type="date"
                    value={range.from}
                    onChange={(event) =>
                      setRange((current) => ({ ...current, from: event.target.value }))
                    }
                    className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  To
                  <input
                    type="date"
                    value={range.to}
                    onChange={(event) =>
                      setRange((current) => ({ ...current, to: event.target.value }))
                    }
                    className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                {canReview && (
                  <label className="text-sm text-gray-600">
                    Employee
                    <select
                      value={employeeId}
                      onChange={(event) => setEmployeeId(event.target.value)}
                      className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">All employees</option>
                      {(employees.data?.employees ?? []).map(
                        (employee: { id: string; fullName: string }) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.fullName}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
              </div>
            </section>

            <TimesheetTable
              timesheet={timesheet.data?.timesheet}
              loading={timesheet.loading}
              error={timesheet.error?.message}
              canReview={canReview}
              onAdjust={(id, values) =>
                run(() =>
                  adjustEntry({
                    variables: {
                      organizationId,
                      id,
                      clockInAt: values.clockInAt,
                      clockOutAt: values.clockOutAt,
                      note: values.note || null,
                    },
                  }),
                )
              }
              onApprove={(id) => run(() => approveEntry({ variables: { organizationId, id } }))}
            />
          </>
        )}
      </main>
    </div>
  );
}
