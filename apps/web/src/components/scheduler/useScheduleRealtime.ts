import { useSubscription } from "@apollo/client";
import { useState } from "react";
import { SCHEDULE_UPDATED_SUBSCRIPTION } from "../../lib/graphql";

export interface ScheduleUpdatedPayload {
  organizationId: string;
  scheduleId: string;
  weekStartDate: string;
  kind: string;
  assignmentIds: string[];
  actorId: string | null;
  version: number;
  updatedAt: string;
}

interface UseScheduleRealtimeOptions {
  organizationId: string;
  weekStartDate: string;
  locationId: string | null;
  calendarId: string | null;
  currentUserId: string | null;
  onRemoteUpdate: () => void;
}

/**
 * Subscribes to organization-scoped schedule updates for the visible week and
 * reports the most recent change made by another user.
 */
export function useScheduleRealtime({
  organizationId,
  weekStartDate,
  locationId,
  calendarId,
  currentUserId,
  onRemoteUpdate,
}: UseScheduleRealtimeOptions) {
  const [remoteUpdate, setRemoteUpdate] = useState<ScheduleUpdatedPayload | null>(null);

  useSubscription<{ scheduleUpdated: ScheduleUpdatedPayload }>(SCHEDULE_UPDATED_SUBSCRIPTION, {
    variables: { organizationId, weekStartDate, locationId, calendarId },
    skip: !organizationId,
    onData: ({ data }) => {
      const payload = data.data?.scheduleUpdated;
      if (!payload) return;
      if (payload.actorId && payload.actorId === currentUserId) return;
      setRemoteUpdate(payload);
      onRemoteUpdate();
    },
  });

  return {
    remoteUpdate,
    dismissRemoteUpdate: () => setRemoteUpdate(null),
  };
}
