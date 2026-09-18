import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import { ClaimStatus, OpenShiftStatus } from "@shiftflow/shared";
import {
  APPROVE_OPEN_SHIFT_CLAIM_MUTATION,
  CANCEL_OPEN_SHIFT_MUTATION,
  CLAIM_OPEN_SHIFT_MUTATION,
  MY_ORGANIZATIONS_QUERY,
  OPEN_SHIFTS_QUERY,
  OPEN_SHIFT_CLAIMS_QUERY,
  REJECT_OPEN_SHIFT_CLAIM_MUTATION,
  ROLES_QUERY,
  SHIFT_TEMPLATES_QUERY,
  WITHDRAW_OPEN_SHIFT_CLAIM_MUTATION,
} from "../lib/graphql";
import { canManageOpenShifts } from "../components/operations/permissions";
import { OpenShiftBoard, type OpenShiftItem } from "../components/operations/OpenShiftBoard";
import { ClaimQueue, type OpenShiftClaimItem } from "../components/operations/ClaimQueue";

export function OpenShiftsPage() {
  const organizations = useQuery(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations?.[0];
  const organizationId: string | undefined = organization?.id;
  const role: string | undefined = organization?.role;
  const canManage = canManageOpenShifts(role);

  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<OpenShiftStatus | "">(OpenShiftStatus.OPEN);
  const [error, setError] = useState<string | null>(null);

  const shiftVariables = {
    organizationId,
    ...(roleId ? { roleId } : {}),
    ...(status ? { status } : {}),
  };
  const shifts = useQuery<{ openShifts: OpenShiftItem[] }>(OPEN_SHIFTS_QUERY, {
    variables: shiftVariables,
    skip: !organizationId,
  });
  const claimVariables = { organizationId, ...(canManage ? { status: ClaimStatus.PENDING } : {}) };
  const claims = useQuery<{ openShiftClaims: OpenShiftClaimItem[] }>(OPEN_SHIFT_CLAIMS_QUERY, {
    variables: claimVariables,
    skip: !organizationId,
  });
  const roles = useQuery(ROLES_QUERY, { variables: { organizationId }, skip: !organizationId });
  const templates = useQuery(SHIFT_TEMPLATES_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });

  const refetchQueries = [
    { query: OPEN_SHIFTS_QUERY, variables: shiftVariables },
    { query: OPEN_SHIFT_CLAIMS_QUERY, variables: claimVariables },
  ];
  const [claimShift] = useMutation(CLAIM_OPEN_SHIFT_MUTATION, { refetchQueries });
  const [withdrawClaim] = useMutation(WITHDRAW_OPEN_SHIFT_CLAIM_MUTATION, { refetchQueries });
  const [approveClaim] = useMutation(APPROVE_OPEN_SHIFT_CLAIM_MUTATION, { refetchQueries });
  const [rejectClaim] = useMutation(REJECT_OPEN_SHIFT_CLAIM_MUTATION, { refetchQueries });
  const [cancelShift] = useMutation(CANCEL_OPEN_SHIFT_MUTATION, { refetchQueries });

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  const roleNames = Object.fromEntries(
    ((roles.data?.roles ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]),
  );
  const templateNames = Object.fromEntries(
    ((templates.data?.shiftTemplates ?? []) as { id: string; name: string; startTime: string; endTime: string }[]).map(
      (item) => [item.id, `${item.name} (${item.startTime}–${item.endTime})`],
    ),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Open shifts</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {organizations.loading ? (
          <p className="text-gray-500">Loading organizations...</p>
        ) : !organizationId ? (
          <p className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">
            Create an organization first.
          </p>
        ) : (
          <>
            {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <section className="flex flex-wrap items-end gap-4 rounded-lg bg-white p-4 shadow">
              <label className="text-sm text-gray-600">
                Role
                <select
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">All roles</option>
                  {((roles.data?.roles ?? []) as { id: string; name: string }[]).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-600">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as OpenShiftStatus | "")}
                  className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  <option value={OpenShiftStatus.OPEN}>Open</option>
                  <option value={OpenShiftStatus.FILLED}>Filled</option>
                  <option value={OpenShiftStatus.CANCELLED}>Cancelled</option>
                </select>
              </label>
            </section>

            <OpenShiftBoard
              shifts={shifts.data?.openShifts ?? []}
              loading={shifts.loading}
              error={shifts.error?.message}
              canManage={canManage}
              roleNames={roleNames}
              templateNames={templateNames}
              onClaim={(openShiftId, message) =>
                run(() => claimShift({ variables: { organizationId, openShiftId, message: message || null } }))
              }
              onCancel={(id) => run(() => cancelShift({ variables: { organizationId, id } }))}
            />

            <ClaimQueue
              claims={claims.data?.openShiftClaims ?? []}
              loading={claims.loading}
              canReview={canManage}
              roleNames={roleNames}
              templateNames={templateNames}
              onApprove={(id) => run(() => approveClaim({ variables: { organizationId, id } }))}
              onReject={(id) => run(() => rejectClaim({ variables: { organizationId, id } }))}
              onWithdraw={(id) => run(() => withdrawClaim({ variables: { organizationId, id } }))}
            />
          </>
        )}
      </main>
    </div>
  );
}
