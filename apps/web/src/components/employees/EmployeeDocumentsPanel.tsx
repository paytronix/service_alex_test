import { useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { EmployeeDocumentType } from "@shiftflow/shared";
import { DELETE_EMPLOYEE_DOCUMENT_MUTATION, EMPLOYEE_DOCUMENTS_QUERY } from "../../lib/graphql";
import { uploadEmployeeDocument } from "../../lib/employeeDocuments";

interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: string;
  fileName: string;
  url: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface EmployeeDocumentsPanelProps {
  organizationId: string;
  employeeId: string;
  canManage: boolean;
}

export function EmployeeDocumentsPanel({
  organizationId,
  employeeId,
  canManage,
}: EmployeeDocumentsPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string>(EmployeeDocumentType.OTHER);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const variables = { organizationId, employeeId };
  const documents = useQuery<{ employeeDocuments: EmployeeDocument[] }>(EMPLOYEE_DOCUMENTS_QUERY, {
    variables,
  });
  const [deleteDocument] = useMutation(DELETE_EMPLOYEE_DOCUMENT_MUTATION, {
    refetchQueries: [{ query: EMPLOYEE_DOCUMENTS_QUERY, variables }],
  });

  const onUpload = async () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadEmployeeDocument({ organizationId, employeeId, type, file });
      if (fileInput.current) fileInput.current.value = "";
      await documents.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Document type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
        >
          {Object.values(EmployeeDocumentType).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input ref={fileInput} type="file" aria-label="Document file" className="text-xs" />
        <button
          type="button"
          disabled={busy}
          onClick={onUpload}
          className="rounded-md bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Upload
        </button>
      </div>
      {documents.loading ? (
        <p className="text-xs text-gray-500">Loading documents...</p>
      ) : (documents.data?.employeeDocuments ?? []).length === 0 ? (
        <p className="text-xs text-gray-500">No documents uploaded.</p>
      ) : (
        <ul className="space-y-1 text-xs text-gray-700">
          {(documents.data?.employeeDocuments ?? []).map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3">
              <span>
                {document.url ? (
                  <a href={document.url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                    {document.fileName}
                  </a>
                ) : (
                  document.fileName
                )}{" "}
                <span className="text-gray-400">
                  · {document.type} · {(document.size / 1024).toFixed(0)} KB
                </span>
              </span>
              {canManage && (
                <button
                  type="button"
                  className="text-red-600 hover:underline"
                  onClick={() => deleteDocument({ variables: { organizationId, id: document.id } })}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
