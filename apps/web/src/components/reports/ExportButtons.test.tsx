import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportGranularity, ReportType } from "@shiftflow/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportButtons } from "./ExportButtons";

const filters = {
  periodMode: "week" as const,
  from: "2026-01-05",
  to: "2026-01-11",
  granularity: ReportGranularity.WEEK,
  employeeId: "",
  departmentId: "",
  roleId: "",
  includeDrafts: false,
};

describe("ExportButtons", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("downloads the selected format with auth and report filters", async () => {
    localStorage.setItem("accessToken", "token-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("csv", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="work_hours-2026-01-05_2026-01-11.csv"' },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:report"),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <ExportButtons
        role="OWNER"
        organizationId="org-1"
        type={ReportType.WORK_HOURS}
        filters={filters}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/reports/export?");
    expect(url).toContain("type=WORK_HOURS");
    expect(url).toContain("format=CSV");
    expect(url).toContain("from=2026-01-05");
    expect(url).toContain("to=2026-01-11");
    expect(init.headers.Authorization).toBe("Bearer token-1");
    expect(click).toHaveBeenCalled();
  });

  it("shows an inline error for failed exports and hides controls without permission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("No access", { status: 403 })));
    const { rerender } = render(
      <ExportButtons
        role="MANAGER"
        organizationId="org-1"
        type={ReportType.WORK_HOURS}
        filters={filters}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(await screen.findByText("No access")).toBeInTheDocument();
    rerender(
      <ExportButtons
        role="SUPERVISOR"
        organizationId="org-1"
        type={ReportType.WORK_HOURS}
        filters={filters}
      />,
    );
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    rerender(
      <ExportButtons
        role="EMPLOYEE"
        organizationId="org-1"
        type={ReportType.WORK_HOURS}
        filters={filters}
      />,
    );
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
  });
});
