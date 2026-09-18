import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeCard, EmployeeDetail } from "./EmployeeCard";

const employee: EmployeeDetail = {
  id: "emp-1",
  fullName: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+15550001111",
  photoUrl: null,
  status: "WORKING",
  hireDate: "2024-03-01T00:00:00.000Z",
  maxHoursPerWeek: 32,
  maxConsecutiveShifts: 4,
  minRestHours: 11,
  role: { id: "role-1", name: "Barista" },
  department: { id: "dep-1", name: "Floor" },
  skills: [{ id: "es-1", skillId: "skill-1", level: 2, skill: { id: "skill-1", name: "Latte" } }],
  availability: [{ dayOfWeek: 1, type: "AVAILABLE", availableFrom: null }],
};

function renderCard(overrides: Partial<Parameters<typeof EmployeeCard>[0]> = {}) {
  const props = {
    employee,
    skills: [
      { id: "skill-1", name: "Latte" },
      { id: "skill-2", name: "Grill" },
    ],
    canManage: true,
    canEditAvailability: true,
    onEdit: vi.fn(),
    onDismiss: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSaveSkills: vi.fn().mockResolvedValue(undefined),
    onSaveAvailability: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<EmployeeCard {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EmployeeCard", () => {
  it("renders basics, work and limits sections", () => {
    renderCard();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("+15550001111")).toBeInTheDocument();
    expect(screen.getByText("Barista")).toBeInTheDocument();
    expect(screen.getByText("2024-03-01")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("preselects assigned skills and saves the new selection", async () => {
    const { onSaveSkills } = renderCard();
    expect(screen.getByLabelText("Latte")).toBeChecked();
    expect(screen.getByLabelText("Grill")).not.toBeChecked();

    await userEvent.click(screen.getByLabelText("Grill"));
    await userEvent.click(screen.getByRole("button", { name: "Save skills" }));

    await waitFor(() => expect(onSaveSkills).toHaveBeenCalledWith(["skill-1", "skill-2"]));
  });

  it("dismisses an employee", async () => {
    const { onDismiss } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it("hides management actions for read-only roles", () => {
    renderCard({ canManage: false, canEditAvailability: false });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save skills" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Latte")).toBeDisabled();
  });

  it("surfaces mutation errors", async () => {
    renderCard({ onDelete: vi.fn().mockRejectedValue(new Error("Employee not found")) });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Employee not found")).toBeInTheDocument();
  });
});
