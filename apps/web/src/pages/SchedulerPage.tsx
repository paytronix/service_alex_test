import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DragCancelEvent,
  type Active,
  type Over,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { useQuery as useApolloQuery, useLazyQuery as useApolloLazyQuery, useMutation as useApolloMutation } from "@apollo/client";
import {
  addDays,
  isoWeekNumber,
  startOfWeek,
  toDateOnly,
  weekDates as getWeekDates,
} from "@shiftflow/shared";
import {
  ASSIGN_SHIFT_MUTATION,
  CALENDARS_QUERY,
  COPY_SHIFT_MUTATION,
  CREATE_DRAFT_SCHEDULE_MUTATION,
  EMPLOYEES_QUERY,
  LOCATIONS_QUERY,
  MOVE_SHIFT_MUTATION,
  MY_ORGANIZATIONS_QUERY,
  PUBLISH_SCHEDULE_MUTATION,
  REMOVE_SHIFT_MUTATION,
  REOPEN_SCHEDULE_MUTATION,
  ROLES_QUERY,
  SCHEDULE_CHANGE_HISTORY_QUERY,
  SCHEDULE_COVERAGE_QUERY,
  SCHEDULE_QUERY,
  SCHEDULE_VERSIONS_QUERY,
  SCHEDULE_VERSION_DIFF_QUERY,
  SHIFT_TEMPLATES_QUERY,
  VALIDATE_ASSIGNMENT_QUERY,
} from "../lib/graphql";
import { useCurrentUser } from "../providers/AuthProvider";
import { BulkActionPanel } from "../components/scheduler/BulkActionPanel";
import { CalendarView } from "../components/scheduler/CalendarView";
import {
  LocationCalendarSelector,
  type CalendarOption,
  type LocationOption,
} from "../components/scheduler/LocationCalendarSelector";
import { ShiftDetailPanel } from "../components/scheduler/ShiftDetailPanel";
import { ShiftInteractionProvider } from "../components/scheduler/ShiftInteractionContext";
import { TemplatePanel } from "../components/scheduler/TemplatePanel";
import { useOfflineSync } from "../components/scheduler/useOfflineSync";
import { useScheduleRealtime } from "../components/scheduler/useScheduleRealtime";
import { SwapQueuePanel } from "../components/swaps/SwapQueuePanel";
import { EmployeePalette } from "../components/scheduler/EmployeePalette";
import { EmployeeView } from "../components/scheduler/EmployeeView";
import { RoleView } from "../components/scheduler/RoleView";
import { WeekGridView } from "../components/scheduler/WeekGridView";
import { canAssignShifts, canManageSchedule } from "../components/scheduler/permissions";
import {
  ScheduleHistoryPanel,
  type ScheduleDiffEntry,
} from "../components/scheduler/ScheduleHistoryPanel";
import { canViewScheduleHistory } from "../components/notifications/permissions";
import type {
  ScheduleChangeItem,
  ScheduleVersionItem,
} from "../components/notifications/types";
import { resolveDragAction } from "../components/scheduler/dragActions";
import type {
  ActiveDrag,
  DropTarget,
  SchedulerAssignment,
  SchedulerCoverage,
  SchedulerEmployee,
  SchedulerRole,
  SchedulerTemplate,
  SchedulerViolation,
} from "../components/scheduler/types";

interface Organization {
  id: string;
  role: string;
}

interface SchedulerData {
  schedule: {
    id: string;
    weekStartDate: string;
    status: string;
    version: number;
    publishedAt: string | null;
    assignments: SchedulerAssignment[];
    requirements: Array<{
      id: string;
      date: string;
      shiftTemplateId: string;
      roleId: string;
      requiredCount: number;
    }>;
  } | null;
}

interface CoverageData {
  scheduleCoverage: SchedulerCoverage[];
}

interface OrganizationsData {
  myOrganizations: Organization[];
}

interface EmployeesData {
  employees: SchedulerEmployee[];
}

interface RolesData {
  roles: SchedulerRole[];
}

interface TemplatesData {
  shiftTemplates: SchedulerTemplate[];
}

interface ValidationData {
  validateAssignment: {
    hasErrors: boolean;
    hasWarnings: boolean;
    violations: SchedulerViolation[];
  };
}

interface ShiftMutationData {
  assignShift?: ShiftMutationPayload;
  moveShift?: ShiftMutationPayload;
  copyShift?: ShiftMutationPayload;
}

interface ShiftMutationPayload {
  assignment: { id: string };
  violations: SchedulerViolation[];
}

const initialWeek = toDateOnly(startOfWeek(new Date()));

function dateTime(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function currentDropTarget(over: Over | null): DropTarget | null {
  const data = over?.data.current;
  return data && typeof data === "object" && "type" in data && data.type === "cell"
    ? (data as DropTarget)
    : null;
}

function activeDrag(active: Active | null): ActiveDrag | null {
  const data = active?.data.current;
  return data && typeof data === "object" && "type" in data && (data.type === "assignment" || data.type === "employee")
    ? (data as ActiveDrag)
    : null;
}

function warningMessages(violations: SchedulerViolation[]): SchedulerViolation[] {
  return violations.filter((violation) => violation.level === "WARNING");
}

export function SchedulerPage() {
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [view, setView] = useState<"calendar" | "grid" | "employees" | "roles">("calendar");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<SchedulerViolation[]>([]);
  const [assignmentViolations, setAssignmentViolations] = useState<
    Record<string, SchedulerViolation[]>
  >({});
  const [copyMode, setCopyMode] = useState(false);
  const [dropValidation, setDropValidation] = useState<ValidationData["validateAssignment"] | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailAssignmentId, setDetailAssignmentId] = useState<string | null>(null);
  const lastValidation = useRef("");

  const user = useCurrentUser();
  const organizations = useApolloQuery<OrganizationsData>(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations[0];
  const organizationId = organization?.id ?? "";
  const canManage = canManageSchedule(organization?.role);
  const canEdit = canAssignShifts(organization?.role);
  const variables = { organizationId, weekStartDate: dateTime(weekStart), locationId, calendarId };
  const scheduleQuery = useApolloQuery<SchedulerData>(SCHEDULE_QUERY, {
    variables,
    skip: !organizationId,
  });
  const schedule = scheduleQuery.data?.schedule ?? null;
  const coverageQuery = useApolloQuery<CoverageData>(SCHEDULE_COVERAGE_QUERY, {
    variables: { organizationId, scheduleId: schedule?.id ?? "" },
    skip: !organizationId || !schedule?.id,
  });
  const employeesQuery = useApolloQuery<EmployeesData>(EMPLOYEES_QUERY, {
    variables: { organizationId, locationId },
    skip: !organizationId,
  });
  const locationsQuery = useApolloQuery<{ locations: LocationOption[] }>(LOCATIONS_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const calendarsQuery = useApolloQuery<{ calendars: CalendarOption[] }>(CALENDARS_QUERY, {
    variables: { organizationId, locationId },
    skip: !organizationId,
  });
  const rolesQuery = useApolloQuery<RolesData>(ROLES_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const templatesQuery = useApolloQuery<TemplatesData>(SHIFT_TEMPLATES_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const [validateAssignment] = useApolloLazyQuery<ValidationData>(VALIDATE_ASSIGNMENT_QUERY, {
    fetchPolicy: "network-only",
  });
  const [createDraft] = useApolloMutation(CREATE_DRAFT_SCHEDULE_MUTATION);
  const [publish] = useApolloMutation(PUBLISH_SCHEDULE_MUTATION);
  const [reopen] = useApolloMutation(REOPEN_SCHEDULE_MUTATION);
  const [assign] = useApolloMutation<ShiftMutationData>(ASSIGN_SHIFT_MUTATION);
  const [move] = useApolloMutation<ShiftMutationData>(MOVE_SHIFT_MUTATION);
  const [copy] = useApolloMutation<ShiftMutationData>(COPY_SHIFT_MUTATION);
  const [remove] = useApolloMutation(REMOVE_SHIFT_MUTATION);
  const week = getWeekDates(weekStart);
  const employees = employeesQuery.data?.employees ?? [];
  const roles = rolesQuery.data?.roles ?? [];
  const shiftTemplates = templatesQuery.data?.shiftTemplates ?? [];
  const assignments = schedule?.assignments ?? [];
  const coverage = coverageQuery.data?.scheduleCoverage ?? [];
  const canSeeHistory = canViewScheduleHistory(organization?.role);
  const historyVariables = { organizationId, scheduleId: schedule?.id ?? "" };
  const historySkip = !organizationId || !schedule?.id || !canSeeHistory;
  const historyQuery = useApolloQuery<{ scheduleChangeHistory: ScheduleChangeItem[] }>(
    SCHEDULE_CHANGE_HISTORY_QUERY,
    { variables: { ...historyVariables, skip: 0, take: 50 }, skip: historySkip },
  );
  const versionsQuery = useApolloQuery<{ scheduleVersions: ScheduleVersionItem[] }>(
    SCHEDULE_VERSIONS_QUERY,
    { variables: historyVariables, skip: historySkip },
  );
  const [loadDiff, diffQuery] = useApolloLazyQuery<{
    scheduleVersionDiff: ScheduleDiffEntry[];
  }>(SCHEDULE_VERSION_DIFF_QUERY, { fetchPolicy: "network-only" });
  const employeeNames = Object.fromEntries(
    employees.map((employee) => [
      employee.id,
      `${employee.firstName} ${employee.lastName}`.trim(),
    ]),
  );
  const offline = useOfflineSync(() => {
    void scheduleQuery.refetch();
  });
  const realtime = useScheduleRealtime({
    organizationId,
    weekStartDate: dateTime(weekStart),
    locationId,
    calendarId,
    currentUserId: user?.id ?? null,
    onRemoteUpdate: () => {
      void scheduleQuery.refetch();
      void coverageQuery.refetch();
    },
  });
  const refetchQueries = [
    { query: SCHEDULE_QUERY, variables },
    ...(schedule?.id
      ? [{ query: SCHEDULE_COVERAGE_QUERY, variables: { organizationId, scheduleId: schedule.id } }]
      : []),
  ];

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey) setCopyMode(true);
    };
    const up = () => setCopyMode(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    setAssignmentViolations({});
    setSelectedIds([]);
    setDetailAssignmentId(null);
  }, [weekStart, locationId, calendarId]);

  const execute = async (action: () => Promise<{ data?: ShiftMutationData | null }>): Promise<void> => {
    setError(null);
    try {
      const result = await action();
      const payload = result.data?.assignShift ?? result.data?.moveShift ?? result.data?.copyShift;
      if (payload) {
        setWarnings(warningMessages(payload.violations));
        setAssignmentViolations((current) => {
          const next = { ...current };
          if (payload.violations.length === 0) {
            delete next[payload.assignment.id];
          } else {
            next[payload.assignment.id] = payload.violations;
          }
          return next;
        });
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "The schedule update failed");
    }
  };

  const validateDrop = async (activeValue: ActiveDrag, target: DropTarget): Promise<void> => {
    if (!schedule?.id) return;
    const assignment = activeValue.type === "assignment" ? activeValue.assignment : null;
    const shiftTemplateId = target.shiftTemplateId ?? assignment?.shiftTemplateId ?? null;
    const template = shiftTemplates.find((item) => item.id === shiftTemplateId);
    const employeeId = target.employeeId ?? assignment?.employeeId ?? (activeValue.type === "employee" ? activeValue.employee.id : "");
    if (!employeeId || !template) return;
    const key = `${employeeId}:${target.date}:${template.id}`;
    if (lastValidation.current === key) return;
    lastValidation.current = key;
    const result = await validateAssignment({
      variables: {
        organizationId,
        input: {
          scheduleId: schedule?.id,
          employeeId,
          shiftTemplateId: template.id,
          date: dateTime(target.date),
          startTime: assignment?.effectiveStartTime ?? template.startTime,
          endTime: assignment?.effectiveEndTime ?? template.endTime,
          breakMinutes: assignment?.breakMinutes ?? 0,
          roleId: assignment?.roleId ?? template.roleId ?? null,
        },
      },
    });
    setDropValidation(result.data?.validateAssignment ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeValue = activeDrag(event.active);
    const target = currentDropTarget(event.over);
    if (activeValue && target) void validateDrop(activeValue, target);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeValue = activeDrag(event.active);
    const target = currentDropTarget(event.over);
    if (!activeValue || !target) return;
    const action = resolveDragAction({ active: activeValue, over: target, copy: copyMode });
    if (action.kind === "noop") return;
    if (action.kind === "needs-shift") {
      setError("Choose a shift by dropping the employee in the Calendar or Week grid view.");
      return;
    }
    if (dropValidation?.hasErrors) {
      setError(dropValidation.violations.filter((item) => item.level === "ERROR").map((item) => item.message).join(" "));
      return;
    }
    if (dropValidation) setWarnings(warningMessages(dropValidation.violations));
    if (action.kind === "assign") {
      const mutationVariables = {
        organizationId,
        scheduleId: schedule?.id,
        employeeId: action.employeeId,
        shiftTemplateId: action.shiftTemplateId,
        date: dateTime(action.date),
      };
      if (!offline.online) {
        offline.enqueue("assignShift", mutationVariables);
        return;
      }
      void execute(() => assign({ variables: mutationVariables, refetchQueries }));
    } else if (action.kind === "move") {
      const mutationVariables = {
        organizationId,
        id: action.assignmentId,
        date: dateTime(action.date),
        shiftTemplateId: action.shiftTemplateId,
        employeeId: action.employeeId,
      };
      if (!offline.online) {
        offline.enqueue("moveShift", mutationVariables);
        return;
      }
      void execute(() => move({ variables: mutationVariables, refetchQueries }));
    } else {
      const mutationVariables = {
        organizationId,
        id: action.assignmentId,
        date: dateTime(action.date),
        employeeId: action.employeeId,
      };
      if (!offline.online) {
        offline.enqueue("copyShift", mutationVariables);
        return;
      }
      void execute(() => copy({ variables: mutationVariables, refetchQueries }));
    }
  };

  const handleDragStart = (_event: DragStartEvent) => {
    setDropValidation(null);
    lastValidation.current = "";
  };
  const handleDragCancel = (_event: DragCancelEvent) => {
    setDropValidation(null);
  };

  const removeAssignment = (assignment: SchedulerAssignment) => {
    if (!offline.online) {
      offline.enqueue("removeShift", { organizationId, id: assignment.id });
      return;
    }
    void execute(() =>
      remove({
        variables: { organizationId, id: assignment.id },
        refetchQueries,
      }),
    );
  };

  const refreshSchedule = () => {
    void scheduleQuery.refetch();
    void coverageQuery.refetch();
  };

  const interaction = {
    selectedIds,
    toggleSelected: (assignmentId: string) =>
      setSelectedIds((current) =>
        current.includes(assignmentId)
          ? current.filter((id) => id !== assignmentId)
          : [...current, assignmentId],
      ),
    openDetails: (assignment: SchedulerAssignment) => setDetailAssignmentId(assignment.id),
  };
  const selectedAssignments = assignments.filter((assignment) =>
    selectedIds.includes(assignment.id),
  );
  const detailAssignment =
    assignments.find((assignment) => assignment.id === detailAssignmentId) ?? null;

  const create = () => {
    void createDraft({
      variables,
      refetchQueries: [{ query: SCHEDULE_QUERY, variables }],
    }).catch((mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to create the draft");
    });
  };

  const publishSchedule = () => {
    if (!schedule) return;
    void publish({ variables: { organizationId, id: schedule.id }, refetchQueries }).catch((mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to publish the schedule");
    });
  };

  const reopenSchedule = () => {
    if (!schedule) return;
    void reopen({ variables: { organizationId, id: schedule.id }, refetchQueries }).catch((mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to reopen the schedule");
    });
  };

  if (organizations.loading || scheduleQuery.loading) {
    return <p className="p-6 text-sm text-gray-600">Loading schedule…</p>;
  }
  if (organizations.error || scheduleQuery.error) {
    return <p className="p-6 text-sm text-red-600">{organizations.error?.message ?? scheduleQuery.error?.message}</p>;
  }

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-sm text-gray-600">
            Week {isoWeekNumber(new Date(`${weekStart}T00:00:00.000Z`))} · {weekStart}–{week[6]}
          </p>
        </div>
        <LocationCalendarSelector
          locations={locationsQuery.data?.locations ?? []}
          calendars={calendarsQuery.data?.calendars ?? []}
          locationId={locationId}
          calendarId={calendarId}
          onLocationChange={setLocationId}
          onCalendarChange={setCalendarId}
        />
        <div className="flex items-center gap-2">
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setWeekStart(toDateOnly(addDays(new Date(`${weekStart}T00:00:00.000Z`), -7)))}>
            Previous
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setWeekStart(initialWeek)}>
            Today
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setWeekStart(toDateOnly(addDays(new Date(`${weekStart}T00:00:00.000Z`), 7)))}>
            Next
          </button>
        </div>
      </header>
      {!offline.online && (
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Offline mode: changes are stored locally and will be sent when the connection returns.
        </div>
      )}
      {offline.pending > 0 && (
        <div className="flex items-center justify-between rounded bg-blue-50 p-3 text-sm text-blue-800">
          <span>
            {offline.pending} unsynchronized change{offline.pending === 1 ? "" : "s"}
            {offline.syncing ? " · syncing…" : ""}
          </span>
          <button type="button" className="text-xs underline" onClick={() => void offline.flush()}>
            Sync now
          </button>
        </div>
      )}
      {offline.failures.length > 0 && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          <strong>Some offline changes were rejected by the server</strong>
          <ul className="mt-1 list-disc pl-5">
            {offline.failures.map((failure) => (
              <li key={failure.mutation.id}>
                {failure.mutation.name}: {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {realtime.remoteUpdate && (
        <div className="flex items-center justify-between rounded bg-indigo-50 p-3 text-sm text-indigo-800">
          <span>This week was edited by another user ({realtime.remoteUpdate.kind}).</span>
          <button
            type="button"
            className="text-xs underline"
            onClick={realtime.dismissRemoteUpdate}
          >
            Dismiss
          </button>
        </div>
      )}
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {warnings.length > 0 && (
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center justify-between">
            <strong>Schedule warnings</strong>
            <button type="button" onClick={() => setWarnings([])} className="text-xs underline">
              Dismiss
            </button>
          </div>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>)}
          </ul>
        </div>
      )}
      {!schedule ? (
        <section className="rounded border border-dashed p-8 text-center">
          <p className="mb-4 text-gray-600">No schedule exists for this week.</p>
          {canManage && (
            <button type="button" onClick={create} className="rounded bg-primary-600 px-4 py-2 text-sm text-white">
              Create draft
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{schedule.status}</span>
              <span className="text-sm text-gray-600">v{schedule.version}</span>
            </div>
            <div className="flex gap-2">
              {canManage && schedule.status === "DRAFT" && (
                <button type="button" onClick={publishSchedule} className="rounded bg-primary-600 px-3 py-2 text-sm text-white">
                  Publish schedule
                </button>
              )}
              {canManage && schedule.status === "PUBLISHED" && (
                <button type="button" onClick={reopenSchedule} className="rounded border px-3 py-2 text-sm">
                  Reopen
                </button>
              )}
            </div>
          </div>
          <nav className="flex gap-2 border-b">
            {([
              ["calendar", "Calendar"],
              ["grid", "Week grid"],
              ["employees", "Employees"],
              ["roles", "Roles"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`border-b-2 px-3 py-2 text-sm ${view === key ? "border-primary-600 text-primary-700" : "border-transparent text-gray-600"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {canEdit && (
            <BulkActionPanel
              organizationId={organizationId}
              selected={selectedAssignments}
              employees={employees}
              weekDates={week}
              onClearSelection={() => setSelectedIds([])}
              onChanged={refreshSchedule}
            />
          )}
          <DndContext
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <ShiftInteractionProvider value={interaction}>
            {view === "calendar" && <CalendarView assignments={assignments} employees={employees} shiftTemplates={shiftTemplates} roles={roles} weekDates={week} coverage={coverage} violationsByAssignment={assignmentViolations} canEdit={canEdit} onRemove={removeAssignment} />}
            {view === "grid" && <WeekGridView assignments={assignments} employees={employees} shiftTemplates={shiftTemplates} roles={roles} weekDates={week} coverage={coverage} violationsByAssignment={assignmentViolations} canEdit={canEdit} onRemove={removeAssignment} />}
            {view === "employees" && <EmployeeView assignments={assignments} employees={employees} shiftTemplates={shiftTemplates} roles={roles} weekDates={week} coverage={coverage} violationsByAssignment={assignmentViolations} canEdit={canEdit} onRemove={removeAssignment} />}
            {view === "roles" && <RoleView assignments={assignments} employees={employees} shiftTemplates={shiftTemplates} roles={roles} weekDates={week} coverage={coverage} violationsByAssignment={assignmentViolations} canEdit={canEdit} onRemove={removeAssignment} />}
            {canEdit && <EmployeePalette employees={employees} canEdit={canEdit} />}
            </ShiftInteractionProvider>
          </DndContext>
          {detailAssignment && (
            <ShiftDetailPanel
              organizationId={organizationId}
              assignment={detailAssignment}
              employees={employees}
              canUploadAttachments={canEdit}
              canRequestSwap
              onClose={() => setDetailAssignmentId(null)}
            />
          )}
          {canManage && (
            <TemplatePanel
              organizationId={organizationId}
              weekStartDate={dateTime(weekStart)}
              scheduleId={schedule.id}
              locationId={locationId}
              calendarId={calendarId}
              shiftTemplates={shiftTemplates}
              roles={roles}
              onGenerated={refreshSchedule}
            />
          )}
          <SwapQueuePanel
            organizationId={organizationId}
            canApprove={canManage}
            onChanged={refreshSchedule}
          />
          {canSeeHistory && schedule && (
            <div className="mt-6">
              <ScheduleHistoryPanel
                changes={historyQuery.data?.scheduleChangeHistory ?? []}
                versions={versionsQuery.data?.scheduleVersions ?? []}
                employeeNames={employeeNames}
                loading={historyQuery.loading || versionsQuery.loading}
                error={
                  historyQuery.error?.message ?? versionsQuery.error?.message ?? null
                }
                diff={diffQuery.data?.scheduleVersionDiff ?? null}
                onCompareVersions={(versionA, versionB) =>
                  void loadDiff({
                    variables: { ...historyVariables, versionA, versionB },
                  })
                }
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
