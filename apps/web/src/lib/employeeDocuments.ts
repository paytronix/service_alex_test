import { apiBaseUrl } from "./attachments";

export interface UploadedEmployeeDocument {
  id: string;
  employeeId: string;
  type: string;
  fileName: string;
  url: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
}

export async function uploadEmployeeDocument(params: {
  organizationId: string;
  employeeId: string;
  type: string;
  file: File;
}): Promise<UploadedEmployeeDocument> {
  const body = new FormData();
  body.append("organizationId", params.organizationId);
  body.append("employeeId", params.employeeId);
  body.append("type", params.type);
  body.append("file", params.file);
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${apiBaseUrl()}/api/employee-documents`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  });
  const payload = (await response.json()) as UploadedEmployeeDocument & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The upload failed");
  return payload;
}

/** Turns a base64 payload (payroll export) into a browser download. */
export function downloadBase64(filename: string, mimeType: string, base64: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
