import { describe, expect, it } from "vitest";
import { MockedProvider } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  APPROVE_SHIFT_SWAP_MUTATION,
  SHIFT_SWAP_REQUESTS_QUERY,
} from "../../lib/graphql";
import { SwapQueuePanel } from "./SwapQueuePanel";

const organizationId = "org-1";

function swap(status: string) {
  return {
    id: "swap-1",
    assignmentId: "assignment-1",
    requestedById: "emp-1",
    targetEmployeeId: "emp-2",
    status,
    message: "Family event",
    createdAt: "2026-10-01T10:00:00.000Z",
    respondedAt: null,
    reviewedAt: null,
    assignment: {
      id: "assignment-1",
      date: "2026-10-05T00:00:00.000Z",
      effectiveStartTime: "08:00",
      effectiveEndTime: "16:00",
      __typename: "ShiftAssignment",
    },
    requestedBy: { id: "emp-1", firstName: "Emma", lastName: "Stone", __typename: "Employee" },
    targetEmployee: { id: "emp-2", firstName: "Liam", lastName: "Neeson", __typename: "Employee" },
    __typename: "ShiftSwapRequest",
  };
}

function queryMock(status: string) {
  return {
    request: { query: SHIFT_SWAP_REQUESTS_QUERY, variables: { organizationId } },
    result: { data: { shiftSwapRequests: [swap(status)] } },
  };
}

describe("SwapQueuePanel", () => {
  it("hides approval actions for employees", async () => {
    render(
      <MockedProvider mocks={[queryMock("ACCEPTED_BY_TARGET")]} addTypename={false}>
        <SwapQueuePanel organizationId={organizationId} canApprove={false} />
      </MockedProvider>,
    );

    await screen.findByText("Emma Stone → Liam Neeson");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("lets a manager approve an accepted swap", async () => {
    let approved = false;
    const approveMock = {
      request: {
        query: APPROVE_SHIFT_SWAP_MUTATION,
        variables: { organizationId, id: "swap-1" },
      },
      result: () => {
        approved = true;
        return {
          data: {
            approveShiftSwap: { ...swap("APPROVED") },
          },
        };
      },
    };

    render(
      <MockedProvider
        mocks={[queryMock("ACCEPTED_BY_TARGET"), approveMock, queryMock("APPROVED")]}
        addTypename={false}
      >
        <SwapQueuePanel organizationId={organizationId} canApprove />
      </MockedProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approved).toBe(true));
  });
});
