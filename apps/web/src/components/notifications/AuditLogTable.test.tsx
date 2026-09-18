import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditLogTable, type AuditLogFilters } from "./AuditLogTable";
import type { AuditLogItem } from "./types";

const items: AuditLogItem[] = [
  {
    id: "a1",
    action: "SCHEDULE_PUBLISHED",
    entity: "Schedule",
    entityId: "sched-1",
    meta: { version: 2 },
    createdAt: "2026-03-02T14:32:00.000Z",
    user: {
      id: "u1",
      email: "mary@example.test",
      firstName: "Mary",
      lastName: "Manager",
    },
  },
  {
    id: "a2",
    action: "EMPLOYEE_CREATED",
    entity: "Employee",
    entityId: null,
    meta: null,
    createdAt: "2026-03-01T09:00:00.000Z",
    user: null,
  },
];

const filters: AuditLogFilters = {
  action: "",
  entity: "",
  actorId: "",
  from: "",
  to: "",
};

function renderTable(overrides: Partial<Parameters<typeof AuditLogTable>[0]> = {}) {
  const props = {
    items,
    filters,
    onFiltersChange: vi.fn(),
    page: 0,
    pageSize: 25,
    total: 60,
    onPageChange: vi.fn(),
    ...overrides,
  };
  render(<AuditLogTable {...props} />);
  return props;
}

describe("AuditLogTable", () => {
  it("renders actions with their actor, falling back to System", () => {
    renderTable();
    expect(screen.getByText("SCHEDULE_PUBLISHED")).toBeInTheDocument();
    expect(screen.getByText("Mary Manager")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Schedule · sched-1")).toBeInTheDocument();
  });

  it("propagates filter changes", async () => {
    const { onFiltersChange } = renderTable();
    await userEvent.type(screen.getByLabelText("Audit action filter"), "S");
    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, action: "S" });
  });

  it("paginates", async () => {
    const { onPageChange } = renderTable({ page: 1 });
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(0);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("shows loading and empty states", () => {
    const { unmount } = render(
      <AuditLogTable
        items={[]}
        filters={filters}
        onFiltersChange={vi.fn()}
        page={0}
        pageSize={25}
        total={0}
        onPageChange={vi.fn()}
        loading
      />,
    );
    expect(screen.getByText("Loading audit log...")).toBeInTheDocument();
    unmount();

    renderTable({ items: [], total: 0 });
    expect(screen.getByText("No audit records")).toBeInTheDocument();
  });
});
