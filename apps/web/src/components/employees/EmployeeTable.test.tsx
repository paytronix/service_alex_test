import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeListItem, EmployeeTable } from "./EmployeeTable";

const items: EmployeeListItem[] = [
  {
    id: "emp-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    photoUrl: null,
    status: "WORKING",
    role: { id: "role-1", name: "Barista" },
    department: { id: "dep-1", name: "Floor" },
  },
  {
    id: "emp-2",
    fullName: "Liam Cookson",
    email: "liam@example.com",
    photoUrl: "https://example.com/liam.png",
    status: "VACATION",
    role: null,
    department: null,
  },
];

function renderTable(overrides: Partial<Parameters<typeof EmployeeTable>[0]> = {}) {
  const props = {
    items,
    departments: [{ id: "dep-1", name: "Floor" }],
    roles: [{ id: "role-1", name: "Barista" }],
    filters: { search: "", departmentId: "", roleId: "", status: "" },
    loading: false,
    canManage: true,
    selectedId: null,
    onFiltersChange: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  };
  render(<EmployeeTable {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EmployeeTable", () => {
  it("renders photo, name, role, department and status", () => {
    renderTable();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    const row = screen.getByTestId("employee-row-emp-1");
    expect(row).toHaveTextContent("Barista");
    expect(row).toHaveTextContent("Floor");
    expect(screen.getByTestId("employee-row-emp-2")).toHaveTextContent("Vacation");
    expect(screen.getByTestId("employee-initials-emp-1")).toHaveTextContent("AL");
    expect(screen.getByAltText("Liam Cookson")).toHaveAttribute(
      "src",
      "https://example.com/liam.png",
    );
  });

  it("reports search and filter changes", async () => {
    const { onFiltersChange } = renderTable();
    await userEvent.type(screen.getByLabelText("Search employees"), "A");
    expect(onFiltersChange).toHaveBeenCalledWith({
      search: "A",
      departmentId: "",
      roleId: "",
      status: "",
    });

    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "SICK");
    expect(onFiltersChange).toHaveBeenCalledWith({
      search: "",
      departmentId: "",
      roleId: "",
      status: "SICK",
    });
  });

  it("selects an employee when the name is clicked", async () => {
    const { onSelect } = renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    expect(onSelect).toHaveBeenCalledWith("emp-1");
  });

  it("hides the create action without manage permission", () => {
    renderTable({ canManage: false });
    expect(screen.queryByRole("button", { name: "New employee" })).not.toBeInTheDocument();
  });

  it("shows a loading state", () => {
    renderTable({ loading: true });
    expect(screen.getByText("Loading employees...")).toBeInTheDocument();
  });
});
