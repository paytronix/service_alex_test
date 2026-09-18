export interface OpenShiftClaimItem {
  id: string;
  openShiftId: string;
  employeeId: string;
  status: string;
  message: string | null;
  createdAt: string;
  employee: { id: string; fullName: string } | null;
  openShift: {
    id: string;
    date: string;
    roleId: string;
    shiftTemplateId: string;
    requiredCount: number;
    filledCount: number;
    status: string;
  };
}

interface ClaimQueueProps {
  claims: OpenShiftClaimItem[];
  loading: boolean;
  canReview: boolean;
  roleNames: Record<string, string>;
  templateNames: Record<string, string>;
  onApprove: (id: string) => Promise<void> | void;
  onReject: (id: string) => Promise<void> | void;
  onWithdraw: (id: string) => Promise<void> | void;
}

export function ClaimQueue({
  claims,
  loading,
  canReview,
  roleNames,
  templateNames,
  onApprove,
  onReject,
  onWithdraw,
}: ClaimQueueProps) {
  if (loading) return <p className="text-gray-500">Loading claims...</p>;

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-base font-semibold">
        {canReview ? "Claim approval queue" : "My claims"}
      </h2>
      {claims.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing to review.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              {canReview && <th className="p-3">Employee</th>}
              <th className="p-3">Shift</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Message</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-b last:border-0">
                {canReview && <td className="p-3">{claim.employee?.fullName ?? claim.employeeId}</td>}
                <td className="p-3">
                  {claim.openShift.date.slice(0, 10)} ·{" "}
                  {templateNames[claim.openShift.shiftTemplateId] ?? claim.openShift.shiftTemplateId}
                </td>
                <td className="p-3">{roleNames[claim.openShift.roleId] ?? claim.openShift.roleId}</td>
                <td className="p-3">{claim.status}</td>
                <td className="p-3">{claim.message ?? "—"}</td>
                <td className="flex gap-3 p-3 text-xs">
                  {claim.status === "PENDING" && canReview && (
                    <>
                      <button
                        type="button"
                        className="text-green-700 hover:underline"
                        onClick={() => onApprove(claim.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => onReject(claim.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {claim.status === "PENDING" && !canReview && (
                    <button
                      type="button"
                      className="text-gray-600 hover:underline"
                      onClick={() => onWithdraw(claim.id)}
                    >
                      Withdraw
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
