import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleCatalogSection, RoleItem } from "./RoleCatalogSection";

const items: RoleItem[] = [
  {
    id: "role-1",
    name: "Barista",
    color: "#FF8800",
    description: "Makes coffee",
    maxLoad: 5,
    hourlyRate: 21.5,
  },
];

function renderSection(overrides: Partial<Parameters<typeof RoleCatalogSection>[0]> = {}) {
  const props = {
    items,
    loading: false,
    canManage: true,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<RoleCatalogSection {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoleCatalogSection", () => {
  it("renders a color marker and role details", () => {
    renderSection();
    expect(screen.getByText("Barista")).toBeInTheDocument();
    expect(screen.getByText("Makes coffee")).toBeInTheDocument();
    expect(screen.getByTestId("role-color-role-1")).toHaveStyle({
      backgroundColor: "#FF8800",
    });
  });

  it("creates a role with color, load and rate", async () => {
    const { onCreate } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "New role" }));
    await userEvent.type(screen.getByLabelText("Role name"), "Cashier");
    await userEvent.type(screen.getByLabelText("Role max load"), "3");
    await userEvent.type(screen.getByLabelText("Role hourly rate"), "18.25");
    await userEvent.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: "Cashier",
        color: "#3B82F6",
        description: "",
        maxLoad: "3",
        hourlyRate: "18.25",
      }),
    );
  });

  it("prefills the form when editing", async () => {
    const { onUpdate } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Role name")).toHaveValue("Barista");
    expect(screen.getByLabelText("Role color")).toHaveValue("#ff8800");

    await userEvent.clear(screen.getByLabelText("Role max load"));
    await userEvent.type(screen.getByLabelText("Role max load"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Save role" }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith("role-1", expect.objectContaining({ maxLoad: "7" })),
    );
  });

  it("deletes a role after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDelete } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("role-1"));
  });

  it("hides management controls for users without permissions", () => {
    renderSection({ canManage: false });
    expect(screen.queryByRole("button", { name: "New role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
