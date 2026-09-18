import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailabilityEditor } from "./AvailabilityEditor";

function renderEditor(overrides: Partial<Parameters<typeof AvailabilityEditor>[0]> = {}) {
  const props = {
    entries: [
      { dayOfWeek: 0, type: "UNAVAILABLE", availableFrom: null },
      { dayOfWeek: 3, type: "AVAILABLE_AFTER", availableFrom: "14:00" },
    ],
    canEdit: true,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<AvailabilityEditor {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AvailabilityEditor", () => {
  it("renders every weekday with its current availability", () => {
    renderEditor();
    expect(screen.getByLabelText("Sunday availability")).toHaveValue("UNAVAILABLE");
    expect(screen.getByLabelText("Monday availability")).toHaveValue("AVAILABLE");
    expect(screen.getByLabelText("Wednesday availability")).toHaveValue("AVAILABLE_AFTER");
    expect(screen.getByLabelText("Wednesday available from")).toHaveValue("14:00");
  });

  it("shows a time input only for available-after days and saves the week", async () => {
    const { onSave } = renderEditor();
    expect(screen.queryByLabelText("Monday available from")).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Monday availability"),
      "AVAILABLE_AFTER",
    );
    await userEvent.type(screen.getByLabelText("Monday available from"), "09:30");
    await userEvent.click(screen.getByRole("button", { name: "Save availability" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          { dayOfWeek: 1, type: "AVAILABLE_AFTER", availableFrom: "09:30" },
          { dayOfWeek: 3, type: "AVAILABLE_AFTER", availableFrom: "14:00" },
        ]),
      ),
    );
  });

  it("requires a time before saving an available-after day", async () => {
    const { onSave } = renderEditor({
      entries: [{ dayOfWeek: 2, type: "AVAILABLE_AFTER", availableFrom: null }],
    });
    await userEvent.click(screen.getByRole("button", { name: "Save availability" }));
    expect(screen.getByText("Set a time for Tuesday")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("disables editing without permission", () => {
    renderEditor({ canEdit: false });
    expect(screen.getByLabelText("Monday availability")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save availability" })).not.toBeInTheDocument();
  });
});
