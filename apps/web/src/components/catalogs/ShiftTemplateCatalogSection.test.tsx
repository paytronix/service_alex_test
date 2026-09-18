import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ShiftTemplateCatalogSection,
  ShiftTemplateItem,
} from "./ShiftTemplateCatalogSection";

const items: ShiftTemplateItem[] = [
  {
    id: "tpl-1",
    name: "Night",
    startTime: "23:00",
    endTime: "08:00",
    crossesMidnight: true,
    breakMinutes: 30,
    minEmployees: 1,
    maxEmployees: 2,
    roleId: null,
  },
  {
    id: "tpl-2",
    name: "Morning",
    startTime: "08:00",
    endTime: "16:00",
    crossesMidnight: false,
    breakMinutes: 0,
    minEmployees: 1,
    maxEmployees: 1,
    roleId: null,
  },
];

function renderSection(
  overrides: Partial<Parameters<typeof ShiftTemplateCatalogSection>[0]> = {},
) {
  const props = {
    items,
    roles: [{ id: "role-1", name: "Barista" }],
    loading: false,
    canManage: true,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<ShiftTemplateCatalogSection {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ShiftTemplateCatalogSection", () => {
  it("marks night shifts in the list", () => {
    renderSection();
    const rows = screen.getAllByRole("row");
    const nightRow = rows.find((row) => row.textContent?.includes("23:00"))!;
    const morningRow = rows.find((row) => row.textContent?.includes("16:00"))!;
    // name cell + "Night" badge in the time cell
    expect(within(nightRow).getAllByText("Night")).toHaveLength(2);
    expect(within(morningRow).queryByText("Night")).not.toBeInTheDocument();
  });

  it("shows the crosses-midnight indicator while editing times", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "New shift template" }));
    expect(screen.queryByText("Crosses midnight")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Shift start time"));
    await userEvent.type(screen.getByLabelText("Shift start time"), "22:00");
    await userEvent.clear(screen.getByLabelText("Shift end time"));
    await userEvent.type(screen.getByLabelText("Shift end time"), "06:00");

    expect(await screen.findByText("Crosses midnight")).toBeInTheDocument();
  });

  it("creates a template with the selected role", async () => {
    const { onCreate } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "New shift template" }));
    await userEvent.type(screen.getByLabelText("Shift template name"), "Evening");
    await userEvent.selectOptions(screen.getByLabelText("Shift role"), "role-1");
    await userEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Evening", roleId: "role-1" }),
      ),
    );
  });

  it("deletes a template after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDelete } = renderSection();
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("tpl-1"));
  });

  it("hides management controls for users without permissions", () => {
    renderSection({ canManage: false });
    expect(
      screen.queryByRole("button", { name: "New shift template" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
