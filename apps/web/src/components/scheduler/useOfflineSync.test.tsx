import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache } from "@apollo/client";
import { readQueue } from "../../lib/offlineQueue";
import { useOfflineSync } from "./useOfflineSync";

const mutate = vi.fn();

function Harness({ onSynced }: { onSynced: () => void }) {
  const { online, pending, enqueue } = useOfflineSync(onSynced);
  return (
    <div>
      <span data-testid="status">{online ? "online" : "offline"}</span>
      <span data-testid="pending">{pending}</span>
      <button
        onClick={() => enqueue("removeShift", { organizationId: "org-1", id: "assignment-1" })}
      >
        queue
      </button>
    </div>
  );
}

function renderHarness(onSynced = vi.fn()) {
  const client = new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
  client.mutate = mutate as unknown as ApolloClient<unknown>["mutate"];
  return render(
    <ApolloProvider client={client}>
      <Harness onSynced={onSynced} />
    </ApolloProvider>,
  );
}

describe("useOfflineSync", () => {
  beforeEach(() => {
    localStorage.clear();
    mutate.mockReset();
    mutate.mockResolvedValue({ data: {} });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  });

  it("persists queued mutations while offline", async () => {
    renderHarness();
    expect(screen.getByTestId("status").textContent).toBe("offline");

    act(() => {
      screen.getByRole("button", { name: "queue" }).click();
    });

    expect(screen.getByTestId("pending").textContent).toBe("1");
    expect(readQueue()).toHaveLength(1);
    expect(readQueue()[0]!.name).toBe("removeShift");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("replays the queue and refetches when the connection returns", async () => {
    const onSynced = vi.fn();
    renderHarness(onSynced);

    act(() => {
      screen.getByRole("button", { name: "queue" }).click();
    });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0]![0].variables).toEqual({
      organizationId: "org-1",
      id: "assignment-1",
    });
    expect(screen.getByTestId("status").textContent).toBe("online");
    expect(screen.getByTestId("pending").textContent).toBe("0");
    expect(readQueue()).toHaveLength(0);
    expect(onSynced).toHaveBeenCalled();
  });
});
