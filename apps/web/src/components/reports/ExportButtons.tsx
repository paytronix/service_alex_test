import { useState } from "react";
import {
  ExportFormat,
  ReportType,
  type ReportGranularity,
} from "@shiftflow/shared";
import { canExportReports } from "./permissions";
import type { ReportFiltersState } from "./types";

interface ExportButtonsProps {
  role?: string | null;
  organizationId: string;
  type: ReportType;
  filters: ReportFiltersState;
}

const formats = [
  [ExportFormat.CSV, "CSV"],
  [ExportFormat.EXCEL, "Excel"],
  [ExportFormat.PDF, "PDF"],
] as const;

function apiBase(): string {
  return (import.meta.env.VITE_API_URL || "/graphql").replace(/\/graphql\/?$/, "");
}

export function ExportButtons({ role, organizationId, type, filters }: ExportButtonsProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canExportReports(role)) return null;

  const download = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      const params = new URLSearchParams({
        organizationId,
        type,
        format,
        from: filters.from,
        to: filters.to,
        granularity: filters.granularity as ReportGranularity,
      });
      if (filters.employeeId) params.set("employeeId", filters.employeeId);
      if (filters.departmentId) params.set("departmentId", filters.departmentId);
      if (filters.roleId) params.set("roleId", filters.roleId);
      if (filters.includeDrafts) params.set("includeDrafts", "true");

      const response = await fetch(`${apiBase()}/api/reports/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
        },
      });
      if (!response.ok) {
        throw new Error((await response.text()) || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? `${type.toLowerCase()}.${format.toLowerCase()}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {formats.map(([format, label]) => (
        <button
          key={format}
          type="button"
          onClick={() => download(format)}
          disabled={busy !== null}
          className="rounded-md border border-primary-600 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 disabled:opacity-50"
        >
          {busy === format ? "Preparing..." : `Export ${label}`}
        </button>
      ))}
      {error && <p className="basis-full text-sm text-red-700">{error}</p>}
    </div>
  );
}
