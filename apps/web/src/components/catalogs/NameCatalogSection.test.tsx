import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NameCatalogSection } from "./NameCatalogSection";

const items = [
  { id: "1", name: "Kitchen" },
  { id: "2", name: "Bar" },
];

function renderSection(overrides: Partial<Parameters<typeof NameCatalogSection>[0]> = {}) {
  const props = {
    title: "Departments",
    entityLabel: "department",
    items,
    loading: false,
    canManage: true,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<NameCatalogSection {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NameCatalogSection", () => {
  it("renders the items", () => {
    renderSection();
    expect(screen.getByText("Kitchen")).toBeInTheDocument();
    expect(screen.getByText("Bar")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    renderSection({ loading: true });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    renderSection({ items: [] });
    expect(screen.getByText("No departments yet.")).toBeInTheDocument();
  });

  it("creates an item with a trimmed name", async () => {
    const { onCreate } = renderSection();
    await userEvent.type(screen.getByLabelText("New department name"), "  Warehouse  ");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Warehouse"));
  });

  it("updates an item", async () => {
    const { onUpdate } = renderSection();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const input = screen.getByLabelText("Edit department name");
    await userEvent.clear(input);
    await userEvent.type(input, "Cold kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("1", "Cold kitchen"));
  });

  it("deletes an item after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDelete } = renderSection();
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("1"));
  });

  it("does not delete when the confirmation is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onDelete } = renderSection();
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("surfaces mutation errors", async () => {
    renderSection({ onCreate: vi.fn().mockRejectedValue(new Error("Name must not be empty")) });
    await userEvent.type(screen.getByLabelText("New department name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Name must not be empty")).toBeInTheDocument();
  });

  it("hides management controls for users without permissions", () => {
    renderSection({ canManage: false });
    expect(screen.queryByLabelText("New department name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
