import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ReportGranularity } from "@shiftflow/shared";
import {
  DEPARTMENTS_QUERY,
  EMPLOYEE_WORKLOAD_REPORT_QUERY,
  EMPLOYEES_QUERY,
  MY_ORGANIZATIONS_QUERY,
  ROLES_QUERY,
  SCHEDULE_FILL_RATE_REPORT_QUERY,
  WORK_HOURS_REPORT_QUERY,
} from "../lib/graphql";
import { ReportsPage } from "./ReportsPage";

const organizationId = "org-1";

function weekRange() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 6));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function catalogMocks() {
  return [
    {
      request: { query: EMPLOYEES_QUERY, variables: { organizationId } },
      result: { data: { employees: [] } },
    },
    {
      request: { query: DEPARTMENTS_QUERY, variables: { organizationId } },
      result: { data: { departments: [] } },
    },
    {
      request: { query: ROLES_QUERY, variables: { organizationId } },
      result: { data: { roles: [] } },
    },
  ];
}

function workHoursMock() {
  const { from, to } = weekRange();
  return {
    request: {
      query: WORK_HOURS_REPORT_QUERY,
      variables: {
        organizationId,
        from,
        to,
        granularity: ReportGranularity.WEEK,
        includeDrafts: false,
      },
    },
    result: {
      data: {
        workHoursReport: {
          from,
          to,
          granularity: "WEEK",
          rows: [],
          totalHours: 0,
          totalShifts: 0,
        },
      },
    },
  };
}

function renderPage(role: string, extraMocks: MockedResponse[] = []) {
  return render(
    <MockedProvider
      mocks={[
        {
          request: { query: MY_ORGANIZATIONS_QUERY },
          result: {
            data: {
              myOrganizations: [
                {
                  id: organizationId,
                  name: "Demo",
                  slug: "demo",
                  timezone: "UTC",
                  role,
                  createdAt: "2026-01-01T00:00:00.000Z",
                },
              ],
            },
          },
        },
        ...catalogMocks(),
        workHoursMock(),
        ...extraMocks,
      ]}
    >
      <BrowserRouter>
        <ReportsPage />
      </BrowserRouter>
    </MockedProvider>,
  );
}

describe("ReportsPage", () => {
  it("shows only work hours and no exports for employees", async () => {
    renderPage("EMPLOYEE");
    await waitFor(() => expect(screen.getByRole("button", { name: "Work hours" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Workload" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fill rate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
  });

  it("switches report tabs for managers", async () => {
    const { from, to } = weekRange();
    renderPage("MANAGER", [
      {
        request: {
          query: EMPLOYEE_WORKLOAD_REPORT_QUERY,
          variables: { organizationId, from, to, includeDrafts: false },
        },
        result: {
          data: {
            employeeWorkloadReport: {
              from,
              to,
              rows: [],
              totalHours: 0,
              averageHours: 0,
            },
          },
        },
      },
      {
        request: {
          query: SCHEDULE_FILL_RATE_REPORT_QUERY,
          variables: { organizationId, from, to, includeDrafts: false },
        },
        result: {
          data: {
            scheduleFillRateReport: {
              from,
              to,
              requiredCount: 0,
              assignedCount: 0,
              filledCount: 0,
              openCount: 0,
              fillRatePercent: 0,
              byDate: [],
              byShift: [],
              byRole: [],
            },
          },
        },
      },
    ]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Workload" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Fill rate" }));
    expect(await screen.findByText("By shift")).toBeInTheDocument();
  });
});
