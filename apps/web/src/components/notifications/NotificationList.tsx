import type { NotificationItem } from "./types";

interface NotificationListProps {
  items: NotificationItem[];
  loading?: boolean;
  error?: string | null;
  onMarkRead: (id: string) => void;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function NotificationList({ items, loading, error, onMarkRead }: NotificationListProps) {
  if (loading) return <p className="p-4 text-sm text-gray-500">Loading notifications...</p>;
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;
  if (items.length === 0) {
    return <p className="p-4 text-sm text-gray-500">No notifications</p>;
  }

  return (
    <ul className="divide-y" aria-label="Notifications">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-start justify-between gap-3 p-3 ${
            item.readAt ? "bg-white" : "bg-primary-50"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{item.title}</p>
            <p className="text-sm text-gray-600">{item.body}</p>
            <p className="mt-1 text-xs text-gray-400">
              {item.type} · {formatTime(item.createdAt)}
            </p>
          </div>
          {!item.readAt && (
            <button
              type="button"
              onClick={() => onMarkRead(item.id)}
              className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
              aria-label={`Mark ${item.title} as read`}
            >
              Mark read
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
