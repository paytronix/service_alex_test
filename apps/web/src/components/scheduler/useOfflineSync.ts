import { useApolloClient } from "@apollo/client";
import { useCallback, useEffect, useState } from "react";
import {
  QUEUED_MUTATION_DOCUMENTS,
  enqueueMutation,
  readQueue,
  writeQueue,
  type FlushFailure,
  type QueuedMutationName,
} from "../../lib/offlineQueue";

/**
 * Offline draft support: queues scheduler mutations in localStorage while the
 * browser is offline and replays them when the connection returns. Conflicts
 * reported by the server are surfaced to the user (server-wins).
 */
export function useOfflineSync(onSynced: () => void) {
  const client = useApolloClient();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(() => readQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [failures, setFailures] = useState<FlushFailure[]>([]);

  const enqueue = useCallback((name: QueuedMutationName, variables: Record<string, unknown>) => {
    setPending(enqueueMutation(name, variables).length);
  }, []);

  const flush = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    const unresolved: FlushFailure[] = [];
    for (const item of queue) {
      try {
        await client.mutate({
          mutation: QUEUED_MUTATION_DOCUMENTS[item.name],
          variables: item.variables,
        });
      } catch (error) {
        unresolved.push({
          mutation: item,
          message: error instanceof Error ? error.message : "The queued change was rejected",
        });
      }
    }
    writeQueue([]);
    setPending(0);
    setFailures(unresolved);
    setSyncing(false);
    onSynced();
  }, [client, onSynced]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flush]);

  return { online, pending, syncing, failures, enqueue, flush };
}
