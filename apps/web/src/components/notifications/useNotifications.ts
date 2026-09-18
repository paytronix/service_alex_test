import { useCallback } from "react";
import { useMutation, useQuery, useSubscription } from "@apollo/client";
import {
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_QUERY,
  NOTIFICATION_RECEIVED_SUBSCRIPTION,
  UNREAD_NOTIFICATIONS_COUNT_QUERY,
} from "../../lib/graphql";
import type { NotificationItem } from "./types";

interface UseNotificationsOptions {
  organizationId: string | null;
  read?: boolean;
  type?: string;
  skip?: number;
  take?: number;
}

export function useNotifications({
  organizationId,
  read,
  type,
  skip,
  take = 10,
}: UseNotificationsOptions) {
  const variables = { organizationId, read, type, skip, take };

  const { data, loading, error, refetch } = useQuery(NOTIFICATIONS_QUERY, {
    variables,
    skip: !organizationId,
  });

  const { data: countData, refetch: refetchCount } = useQuery(
    UNREAD_NOTIFICATIONS_COUNT_QUERY,
    { variables: { organizationId }, skip: !organizationId },
  );

  useSubscription(NOTIFICATION_RECEIVED_SUBSCRIPTION, {
    variables: { organizationId },
    skip: !organizationId,
    onData: () => {
      void refetch();
      void refetchCount();
    },
  });

  const [markReadMutation] = useMutation(MARK_NOTIFICATION_READ_MUTATION);
  const [markAllReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_READ_MUTATION);

  const markRead = useCallback(
    async (id: string) => {
      if (!organizationId) return;
      await markReadMutation({ variables: { organizationId, id } });
      await Promise.all([refetch(), refetchCount()]);
    },
    [markReadMutation, organizationId, refetch, refetchCount],
  );

  const markAllRead = useCallback(async () => {
    if (!organizationId) return;
    await markAllReadMutation({ variables: { organizationId } });
    await Promise.all([refetch(), refetchCount()]);
  }, [markAllReadMutation, organizationId, refetch, refetchCount]);

  return {
    items: (data?.notifications ?? []) as NotificationItem[],
    unreadCount: (countData?.unreadNotificationsCount ?? 0) as number,
    loading,
    error: error?.message ?? null,
    markRead,
    markAllRead,
    refetch,
  };
}
