import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import {
  ACCEPT_SHIFT_SWAP_MUTATION,
  APPROVE_SHIFT_SWAP_MUTATION,
  CANCEL_SHIFT_SWAP_MUTATION,
  REJECT_SHIFT_SWAP_MUTATION,
  SHIFT_SWAP_REQUESTS_QUERY,
} from "../../lib/graphql";

interface SwapRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  assignment: {
    id: string;
    date: string;
    effectiveStartTime: string;
    effectiveEndTime: string;
  };
  requestedBy: { id: string; firstName: string; lastName: string };
  targetEmployee: { id: string; firstName: string; lastName: string };
}

interface SwapQueuePanelProps {
  organizationId: string;
  canApprove: boolean;
  onChanged?: () => void;
}

export function SwapQueuePanel({ organizationId, canApprove, onChanged }: SwapQueuePanelProps) {
  const [error, setError] = useState<string | null>(null);
  const variables = { organizationId };
  const swapsQuery = useQuery<{ shiftSwapRequests: SwapRequest[] }>(SHIFT_SWAP_REQUESTS_QUERY, {
    variables,
    skip: !organizationId,
  });
  const refetchQueries = [{ query: SHIFT_SWAP_REQUESTS_QUERY, variables }];
  const [accept] = useMutation(ACCEPT_SHIFT_SWAP_MUTATION, { refetchQueries });
  const [approve] = useMutation(APPROVE_SHIFT_SWAP_MUTATION, { refetchQueries });
  const [reject] = useMutation(REJECT_SHIFT_SWAP_MUTATION, { refetchQueries });
  const [cancel] = useMutation(CANCEL_SHIFT_SWAP_MUTATION, { refetchQueries });

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setError(null);
    try {
      await action();
      onChanged?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action failed");
    }
  };

  const swaps = swapsQuery.data?.shiftSwapRequests ?? [];

  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-semibold">Shift swaps</h2>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {swapsQuery.loading && <p className="text-sm text-gray-600">Loading swap requests…</p>}
      {!swapsQuery.loading && swaps.length === 0 && (
        <p className="text-sm text-gray-600">No swap requests.</p>
      )}
      <ul className="space-y-2">
        {swaps.map((swap) => (
          <li key={swap.id} className="rounded bg-gray-50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {swap.requestedBy.firstName} {swap.requestedBy.lastName} →{" "}
                  {swap.targetEmployee.firstName} {swap.targetEmployee.lastName}
                </p>
                <p className="text-gray-600">
                  {swap.assignment.date.slice(0, 10)} · {swap.assignment.effectiveStartTime}–
                  {swap.assignment.effectiveEndTime} · {swap.status}
                </p>
                {swap.message && <p className="text-gray-700">{swap.message}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {swap.status === "PENDING" && (
                  <button
                    type="button"
                    className="rounded border bg-white px-3 py-1"
                    onClick={() => void run(() => accept({ variables: { organizationId, id: swap.id } }))}
                  >
                    Accept
                  </button>
                )}
                {swap.status === "PENDING" && (
                  <button
                    type="button"
                    className="rounded border bg-white px-3 py-1"
                    onClick={() => void run(() => cancel({ variables: { organizationId, id: swap.id } }))}
                  >
                    Cancel
                  </button>
                )}
                {canApprove && swap.status === "ACCEPTED_BY_TARGET" && (
                  <button
                    type="button"
                    className="rounded bg-primary-600 px-3 py-1 text-white"
                    onClick={() => void run(() => approve({ variables: { organizationId, id: swap.id } }))}
                  >
                    Approve
                  </button>
                )}
                {canApprove && swap.status !== "APPROVED" && swap.status !== "REJECTED" && (
                  <button
                    type="button"
                    className="rounded border bg-white px-3 py-1 text-red-700"
                    onClick={() => void run(() => reject({ variables: { organizationId, id: swap.id } }))}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
