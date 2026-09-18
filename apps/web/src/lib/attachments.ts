export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_REST_URL;
  if (configured) return configured.replace(/\/$/, "");
  const graphqlUrl = import.meta.env.VITE_API_URL || "/graphql";
  const absolute = graphqlUrl.startsWith("http")
    ? graphqlUrl
    : `${window.location.origin}${graphqlUrl}`;
  return absolute.replace(/\/graphql\/?$/, "");
}

export interface UploadedAttachment {
  id: string;
  fileName: string;
  url: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
}

export async function uploadAttachment(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  file: File;
}): Promise<UploadedAttachment> {
  const body = new FormData();
  body.append("organizationId", params.organizationId);
  body.append("entityType", params.entityType);
  body.append("entityId", params.entityId);
  body.append("file", params.file);
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${apiBaseUrl()}/api/attachments`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  });
  const payload = (await response.json()) as UploadedAttachment & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The upload failed");
  return payload;
}

export function attachmentDownloadUrl(attachmentId: string, organizationId: string): string {
  return `${apiBaseUrl()}/api/attachments/${attachmentId}?organizationId=${encodeURIComponent(organizationId)}`;
}
