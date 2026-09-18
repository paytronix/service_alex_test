import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  APPROVE_LEAVE_REQUEST_MUTATION,
  CREATE_EMPLOYEE_MUTATION,
  CREATE_LEAVE_REQUEST_MUTATION,
  DELETE_EMPLOYEE_MUTATION,
  DEPARTMENTS_QUERY,
  DISMISS_EMPLOYEE_MUTATION,
  EMPLOYEES_QUERY,
  EMPLOYEE_QUERY,
  LEAVE_REQUESTS_QUERY,
  MY_EMPLOYEE_PROFILE_QUERY,
  MY_ORGANIZATIONS_QUERY,
  REJECT_LEAVE_REQUEST_MUTATION,
  ROLES_QUERY,
  SET_AVAILABILITY_MUTATION,
  SET_EMPLOYEE_SKILLS_MUTATION,
  SKILLS_QUERY,
  UPDATE_EMPLOYEE_MUTATION,
} from "../lib/graphql";
import {
  EmployeeFilters,
  EmployeeListItem,
  EmployeeTable,
} from "../components/employees/EmployeeTable";
import { EmployeeCard, EmployeeDetail } from "../components/employees/EmployeeCard";
import {
  EmployeeForm,
  EmployeeFormValues,
  emptyEmployeeForm,
} from "../components/employees/EmployeeForm";
import {
  LeaveRequestItem,
  LeaveRequestPanel,
} from "../components/employees/LeaveRequestPanel";
import { AvailabilityEntry } from "../components/employees/AvailabilityEditor";
import { canManageEmployees, canReviewLeaveRequests } from "../components/employees/permissions";

interface OrganizationOption {
  id: string;
  name: string;
  role: string;
}

const emptyFilters: EmployeeFilters = { search: "", departmentId: "", roleId: "", status: "" };

function optionalInt(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number.parseInt(trimmed, 10);
}

function optionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toFormValues(employee: EmployeeDetail): EmployeeFormValues {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? "",
    photoUrl: employee.photoUrl ?? "",
    roleId: employee.role?.id ?? "",
    departmentId: employee.department?.id ?? "",
    hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().slice(0, 10) : "",
    status: employee.status,
    maxHoursPerWeek: employee.maxHoursPerWeek === null ? "" : String(employee.maxHoursPerWeek),
    maxConsecutiveShifts:
      employee.maxConsecutiveShifts === null ? "" : String(employee.maxConsecutiveShifts),
    minRestHours: employee.minRestHours === null ? "" : String(employee.minRestHours),
  };
}

export function EmployeesPage() {
  const { data: orgData, loading: orgLoading } = useQuery(MY_ORGANIZATIONS_QUERY);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmployeeFilters>(emptyFilters);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"hidden" | "create" | "edit">("hidden");

  const organizations: OrganizationOption[] = orgData?.myOrganizations ?? [];
  const organizationId = selectedOrgId ?? organizations[0]?.id ?? null;
  const organization = organizations.find((org) => org.id === organizationId);
  const canManage = canManageEmployees(organization?.role);
  const canReview = canReviewLeaveRequests(organization?.role);

  const skip = !organizationId;
  const listVariables = {
    organizationId: organizationId ?? "",
    search: filters.search === "" ? null : filters.search,
    departmentId: filters.departmentId === "" ? null : filters.departmentId,
    roleId: filters.roleId === "" ? null : filters.roleId,
    status: filters.status === "" ? null : filters.status,
  };

  const { data: employeesData, loading: employeesLoading } = useQuery(EMPLOYEES_QUERY, {
    variables: listVariables,
    skip,
  });
  const { data: departmentsData } = useQuery(DEPARTMENTS_QUERY, {
    variables: { organizationId },
    skip,
  });
  const { data: rolesData } = useQuery(ROLES_QUERY, { variables: { organizationId }, skip });
  const { data: skillsData } = useQuery(SKILLS_QUERY, { variables: { organizationId }, skip });
  const { data: profileData } = useQuery(MY_EMPLOYEE_PROFILE_QUERY, {
    variables: { organizationId },
    skip,
  });
  const { data: employeeData } = useQuery(EMPLOYEE_QUERY, {
    variables: { organizationId, id: selectedEmployeeId },
    skip: skip || !selectedEmployeeId,
  });
  const { data: leaveData, loading: leaveLoading } = useQuery(LEAVE_REQUESTS_QUERY, {
    variables: { organizationId },
    skip,
  });

  const refetchQueries = [
    { query: EMPLOYEES_QUERY, variables: listVariables },
    ...(selectedEmployeeId
      ? [{ query: EMPLOYEE_QUERY, variables: { organizationId, id: selectedEmployeeId } }]
      : []),
  ];
  const leaveRefetch = [{ query: LEAVE_REQUESTS_QUERY, variables: { organizationId } }];

  const [createEmployee] = useMutation(CREATE_EMPLOYEE_MUTATION, { refetchQueries });
  const [updateEmployee] = useMutation(UPDATE_EMPLOYEE_MUTATION, { refetchQueries });
  const [dismissEmployee] = useMutation(DISMISS_EMPLOYEE_MUTATION, { refetchQueries });
  const [deleteEmployee] = useMutation(DELETE_EMPLOYEE_MUTATION, { refetchQueries });
  const [setEmployeeSkills] = useMutation(SET_EMPLOYEE_SKILLS_MUTATION, { refetchQueries });
  const [setAvailability] = useMutation(SET_AVAILABILITY_MUTATION, { refetchQueries });
  const [createLeaveRequest] = useMutation(CREATE_LEAVE_REQUEST_MUTATION, {
    refetchQueries: leaveRefetch,
  });
  const [approveLeaveRequest] = useMutation(APPROVE_LEAVE_REQUEST_MUTATION, {
    refetchQueries: leaveRefetch,
  });
  const [rejectLeaveRequest] = useMutation(REJECT_LEAVE_REQUEST_MUTATION, {
    refetchQueries: leaveRefetch,
  });

  const employees: EmployeeListItem[] = employeesData?.employees ?? [];
  const employee: EmployeeDetail | null = employeeData?.employee ?? null;
  const myEmployeeId: string | null = profileData?.myEmployeeProfile?.id ?? null;
  const leaveRequests: LeaveRequestItem[] = leaveData?.leaveRequests ?? [];
  const employeeNames = Object.fromEntries(employees.map((item) => [item.id, item.fullName]));

  const toVariables = (values: EmployeeFormValues) => ({
    organizationId,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: optionalString(values.phone),
    photoUrl: optionalString(values.photoUrl),
    roleId: values.roleId === "" ? null : values.roleId,
    departmentId: values.departmentId === "" ? null : values.departmentId,
    hireDate: values.hireDate === "" ? null : new Date(values.hireDate).toISOString(),
    status: values.status,
    maxHoursPerWeek: optionalInt(values.maxHoursPerWeek),
    maxConsecutiveShifts: optionalInt(values.maxConsecutiveShifts),
    minRestHours: optionalInt(values.minRestHours),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Employees</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {orgLoading ? (
          <p className="text-sm text-gray-500">Loading organizations...</p>
        ) : !organizationId ? (
          <p className="text-sm text-gray-500">Create an organization first to manage employees.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm text-gray-600">
                Organization
                <select
                  aria-label="Organization"
                  value={organizationId}
                  onChange={(e) => {
                    setSelectedOrgId(e.target.value);
                    setSelectedEmployeeId(null);
                  }}
                  className="ml-2 rounded-md border border-gray-300 px-3 py-2"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>
              {!canManage && (
                <span className="text-sm text-gray-500">
                  Read-only access — only Owners and Managers can edit employees.
                </span>
              )}
            </div>

            {formMode !== "hidden" && (
              <EmployeeForm
                title={formMode === "create" ? "New employee" : "Edit employee"}
                initialValues={
                  formMode === "edit" && employee ? toFormValues(employee) : emptyEmployeeForm
                }
                roles={rolesData?.roles ?? []}
                departments={departmentsData?.departments ?? []}
                onCancel={() => setFormMode("hidden")}
                onSubmit={async (values) => {
                  if (formMode === "create") {
                    await createEmployee({ variables: toVariables(values) });
                  } else if (employee) {
                    await updateEmployee({
                      variables: { ...toVariables(values), id: employee.id },
                    });
                  }
                  setFormMode("hidden");
                }}
              />
            )}

            <EmployeeTable
              items={employees}
              departments={departmentsData?.departments ?? []}
              roles={rolesData?.roles ?? []}
              filters={filters}
              loading={employeesLoading}
              canManage={canManage}
              selectedId={selectedEmployeeId}
              onFiltersChange={setFilters}
              onSelect={(id) => {
                setSelectedEmployeeId(id);
                setFormMode("hidden");
              }}
              onCreate={() => {
                setSelectedEmployeeId(null);
                setFormMode("create");
              }}
            />

            {employee && (
              <EmployeeCard
                employee={employee}
                skills={skillsData?.skills ?? []}
                canManage={canManage}
                canEditAvailability={canManage || employee.id === myEmployeeId}
                onEdit={() => setFormMode("edit")}
                onDismiss={async () => {
                  await dismissEmployee({ variables: { organizationId, id: employee.id } });
                }}
                onDelete={async () => {
                  await deleteEmployee({ variables: { organizationId, id: employee.id } });
                  setSelectedEmployeeId(null);
                }}
                onSaveSkills={async (skillIds) => {
                  await setEmployeeSkills({
                    variables: { organizationId, employeeId: employee.id, skillIds },
                  });
                }}
                onSaveAvailability={async (entries: AvailabilityEntry[]) => {
                  await setAvailability({
                    variables: {
                      organizationId,
                      employeeId: employee.id,
                      entries: entries.map((entry) => ({
                        dayOfWeek: entry.dayOfWeek,
                        type: entry.type,
                        availableFrom: entry.availableFrom,
                      })),
                    },
                  });
                }}
              >
                <LeaveRequestPanel
                  title="Requests"
                  items={leaveRequests.filter((item) => item.employeeId === employee.id)}
                  loading={leaveLoading}
                  canReview={canReview}
                  canCreate={canManage || employee.id === myEmployeeId}
                  onCreate={async (values) => {
                    await createLeaveRequest({
                      variables: {
                        organizationId,
                        employeeId: employee.id,
                        type: values.type,
                        startDate: new Date(values.startDate).toISOString(),
                        endDate: new Date(values.endDate).toISOString(),
                        reason: optionalString(values.reason),
                      },
                    });
                  }}
                  onApprove={async (id) => {
                    await approveLeaveRequest({ variables: { organizationId, id } });
                  }}
                  onReject={async (id) => {
                    await rejectLeaveRequest({ variables: { organizationId, id } });
                  }}
                />
              </EmployeeCard>
            )}

            {canReview && (
              <LeaveRequestPanel
                title="Leave request queue"
                items={leaveRequests}
                loading={leaveLoading}
                canReview={canReview}
                canCreate={false}
                employeeNames={employeeNames}
                onCreate={async () => undefined}
                onApprove={async (id) => {
                  await approveLeaveRequest({ variables: { organizationId, id } });
                }}
                onReject={async (id) => {
                  await rejectLeaveRequest({ variables: { organizationId, id } });
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
