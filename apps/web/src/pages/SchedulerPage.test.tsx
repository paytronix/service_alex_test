import { MockedProvider } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { startOfWeek, toDateOnly } from "@shiftflow/shared";
import { SchedulerPage } from "./SchedulerPage";
import {
  CALENDARS_QUERY,
  EMPLOYEES_QUERY,
  LOCATIONS_QUERY,
  MY_ORGANIZATIONS_QUERY,
  ROLES_QUERY,
  SCHEDULE_COVERAGE_QUERY,
  SCHEDULE_QUERY,
  SHIFT_SWAP_REQUESTS_QUERY,
  SHIFT_TEMPLATES_QUERY,
} from "../lib/graphql";

const organizationId = "organization-1";
const weekStartDate = toDateOnly(startOfWeek(new Date()));

function mocks(role: string, schedule: unknown) {
  return [
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
    {
      request: {
        query: SCHEDULE_QUERY,
        variables: {
          organizationId,
          weekStartDate: `${weekStartDate}T00:00:00.000Z`,
          locationId: null,
          calendarId: null,
        },
      },
      result: { data: { schedule } },
    },
    {
      request: { query: EMPLOYEES_QUERY, variables: { organizationId, locationId: null } },
      result: { data: { employees: [] } },
    },
    {
      request: { query: LOCATIONS_QUERY, variables: { organizationId } },
      result: { data: { locations: [] } },
    },
    {
      request: { query: CALENDARS_QUERY, variables: { organizationId, locationId: null } },
      result: { data: { calendars: [] } },
    },
    {
      request: { query: SHIFT_SWAP_REQUESTS_QUERY, variables: { organizationId } },
      result: { data: { shiftSwapRequests: [] } },
    },
    {
      request: { query: ROLES_QUERY, variables: { organizationId } },
      result: { data: { roles: [] } },
    },
    {
      request: { query: SHIFT_TEMPLATES_QUERY, variables: { organizationId } },
      result: { data: { shiftTemplates: [] } },
    },
    ...(schedule
      ? [{
          request: {
            query: SCHEDULE_COVERAGE_QUERY,
            variables: { organizationId, scheduleId: (schedule as { id: string }).id },
          },
          result: { data: { scheduleCoverage: [] } },
        }]
      : []),
  ];
}

function renderPage(role: string, schedule: unknown) {
  return render(
    <MockedProvider mocks={mocks(role, schedule)}>
      <SchedulerPage />
    </MockedProvider>,
  );
}

const schedule = {
  id: "schedule-1",
  organizationId,
  weekStartDate: `${weekStartDate}T00:00:00.000Z`,
  status: "DRAFT",
  version: 1,
  publishedAt: null,
  assignments: [],
  requirements: [],
};

describe("SchedulerPage", () => {
  it("renders the week header and create-draft empty state", async () => {
    renderPage("OWNER", null);
    await waitFor(() => expect(screen.getByText(new RegExp(`Week \\d+ · ${weekStartDate}`))).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Create draft" })).toBeInTheDocument();
  });

  it("shows publish for an owner", async () => {
    renderPage("OWNER", schedule);
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish schedule" })).toBeInTheDocument());
  });

  it("hides publish for an employee", async () => {
    renderPage("EMPLOYEE", schedule);
    await waitFor(() => expect(screen.getByText("DRAFT")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Publish schedule" })).not.toBeInTheDocument();
  });
});
