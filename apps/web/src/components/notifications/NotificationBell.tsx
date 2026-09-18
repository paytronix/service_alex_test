import { useState } from "react";
import { NotificationList } from "./NotificationList";
import type { NotificationItem } from "./types";

interface NotificationBellProps {
  unreadCount: number;
  items: NotificationItem[];
  loading?: boolean;
  error?: string | null;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpen?: () => void;
}

export function NotificationBell({
  unreadCount,
  items,
  loading,
  error,
  onMarkRead,
  onMarkAllRead,
  onOpen,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen((previous) => {
      if (!previous) onOpen?.();
      return !previous;
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-96 rounded-lg border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
              className="text-xs text-primary-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <NotificationList
              items={items}
              loading={loading}
              error={error}
              onMarkRead={onMarkRead}
            />
          </div>
        </div>
      )}
    </div>
  );
}
