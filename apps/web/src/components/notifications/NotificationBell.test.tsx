import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./NotificationBell";
import type { NotificationItem } from "./types";

const items: NotificationItem[] = [
  {
    id: "n1",
    type: "SHIFT_ASSIGNED",
    channel: "IN_APP",
    status: "SENT",
    title: "New shift assigned",
    body: "Monday 09:00 - 17:00",
    readAt: null,
    createdAt: "2026-03-02T14:32:00.000Z",
  },
  {
    id: "n2",
    type: "SCHEDULE_PUBLISHED",
    channel: "IN_APP",
    status: "READ",
    title: "Schedule published",
    body: "Week of 2026-03-02",
    readAt: "2026-03-02T15:00:00.000Z",
    createdAt: "2026-03-02T14:00:00.000Z",
  },
];

function renderBell(overrides: Partial<Parameters<typeof NotificationBell>[0]> = {}) {
  const props = {
    unreadCount: 1,
    items,
    onMarkRead: vi.fn(),
    onMarkAllRead: vi.fn(),
    ...overrides,
  };
  render(<NotificationBell {...props} />);
  return props;
}

describe("NotificationBell", () => {
  it("shows the unread counter", () => {
    renderBell({ unreadCount: 3 });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Notifications, 3 unread" }),
    ).toBeInTheDocument();
  });

  it("opens the dropdown and lists notifications", async () => {
    const { onOpen } = renderBell({ onOpen: vi.fn() });
    expect(screen.queryByText("New shift assigned")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(screen.getByText("New shift assigned")).toBeInTheDocument();
    expect(screen.getByText("Schedule published")).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalled();
  });

  it("marks a single notification as read", async () => {
    const { onMarkRead } = renderBell();
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Mark New shift assigned as read" }),
    );
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("marks everything read and disables the action without unread items", async () => {
    const { onMarkAllRead } = renderBell();
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalled();
  });

  it("shows an empty state", async () => {
    renderBell({ items: [], unreadCount: 0 });
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });
});
