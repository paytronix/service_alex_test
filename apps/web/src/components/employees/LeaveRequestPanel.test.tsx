import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveRequestItem, LeaveRequestPanel } from "./LeaveRequestPanel";

const items: LeaveRequestItem[] = [
  {
    id: "leave-1",
    employeeId: "emp-1",
    type: "VACATION",
    status: "PENDING",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-10T00:00:00.000Z",
    reason: "Holiday",
  },
  {
    id: "leave-2",
    employeeId: "emp-2",
    type: "SICK",
    status: "APPROVED",
    startDate: "2026-02-01T00:00:00.000Z",
    endDate: "2026-02-03T00:00:00.000Z",
    reason: null,
  },
];

function renderPanel(overrides: Partial<Parameters<typeof LeaveRequestPanel>[0]> = {}) {
  const props = {
    items,
    loading: false,
    canReview: true,
    canCreate: true,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onApprove: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<LeaveRequestPanel {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LeaveRequestPanel", () => {
  it("lists requests with their period and status", () => {
    renderPanel();
    expect(screen.getByText("2026-07-01 → 2026-07-10")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("creates a leave request", async () => {
    const { onCreate } = renderPanel();
    await userEvent.selectOptions(screen.getByLabelText("Leave type"), "SICK");
    await userEvent.type(screen.getByLabelText("Leave start date"), "2026-08-01");
    await userEvent.type(screen.getByLabelText("Leave end date"), "2026-08-05");
    await userEvent.type(screen.getByLabelText("Leave reason"), "Flu");
    await userEvent.click(screen.getByRole("button", { name: "Request leave" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        type: "SICK",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
        reason: "Flu",
      }),
    );
  });

  it("validates the date range before submitting", async () => {
    const { onCreate } = renderPanel();
    await userEvent.type(screen.getByLabelText("Leave start date"), "2026-08-10");
    await userEvent.type(screen.getByLabelText("Leave end date"), "2026-08-01");
    await userEvent.click(screen.getByRole("button", { name: "Request leave" }));

    expect(
      screen.getByText("End date must not be earlier than start date"),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("approves and rejects only pending requests", async () => {
    const { onApprove, onReject } = renderPanel();
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    expect(screen.getByText("Reviewed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith("leave-1"));

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith("leave-1"));
  });

  it("hides review actions and the form for unauthorized roles", () => {
    renderPanel({ canReview: false, canCreate: false });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request leave" })).not.toBeInTheDocument();
  });

  it("shows employee names in the manager queue", () => {
    renderPanel({ employeeNames: { "emp-1": "Ada Lovelace", "emp-2": "Liam Cookson" } });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Liam Cookson")).toBeInTheDocument();
  });
});
