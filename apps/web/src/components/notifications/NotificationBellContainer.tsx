import { NotificationBell } from "./NotificationBell";
import { useNotifications } from "./useNotifications";

export function NotificationBellContainer({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const { items, unreadCount, loading, error, markRead, markAllRead, refetch } =
    useNotifications({ organizationId, take: 10 });

  if (!organizationId) return null;

  return (
    <NotificationBell
      unreadCount={unreadCount}
      items={items}
      loading={loading}
      error={error}
      onMarkRead={(id) => void markRead(id)}
      onMarkAllRead={() => void markAllRead()}
      onOpen={() => void refetch()}
    />
  );
}
