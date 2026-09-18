import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { CertificationStatus } from "@shiftflow/shared";
import {
  CERTIFICATIONS_QUERY,
  CREATE_CERTIFICATION_MUTATION,
  DELETE_CERTIFICATION_MUTATION,
  UPDATE_CERTIFICATION_MUTATION,
} from "../../lib/graphql";

interface Certification {
  id: string;
  employeeId: string;
  skillId: string | null;
  name: string;
  issuedAt: string | null;
  expiresAt: string | null;
  status: CertificationStatus;
}

interface CertificationsPanelProps {
  organizationId: string;
  employeeId: string;
  canManage: boolean;
  skills: { id: string; name: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  [CertificationStatus.VALID]: "bg-green-100 text-green-700",
  [CertificationStatus.EXPIRING]: "bg-amber-100 text-amber-700",
  [CertificationStatus.EXPIRED]: "bg-red-100 text-red-700",
};

export function CertificationsPanel({
  organizationId,
  employeeId,
  canManage,
  skills,
}: CertificationsPanelProps) {
  const [form, setForm] = useState({ name: "", skillId: "", issuedAt: "", expiresAt: "" });
  const [error, setError] = useState<string | null>(null);

  const variables = { organizationId, employeeId };
  const certifications = useQuery<{ certifications: Certification[] }>(CERTIFICATIONS_QUERY, {
    variables,
  });
  const refetchQueries = [{ query: CERTIFICATIONS_QUERY, variables }];
  const [createCertification] = useMutation(CREATE_CERTIFICATION_MUTATION, { refetchQueries });
  const [updateCertification] = useMutation(UPDATE_CERTIFICATION_MUTATION, { refetchQueries });
  const [deleteCertification] = useMutation(DELETE_CERTIFICATION_MUTATION, { refetchQueries });

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold text-gray-700">Certifications</h3>
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {certifications.loading ? (
        <p className="text-xs text-gray-500">Loading certifications...</p>
      ) : (certifications.data?.certifications ?? []).length === 0 ? (
        <p className="text-xs text-gray-500">No certifications recorded.</p>
      ) : (
        <ul className="space-y-2 text-xs text-gray-700">
          {(certifications.data?.certifications ?? []).map((certification) => (
            <li key={certification.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{certification.name}</span>
              <span
                className={`rounded px-2 py-0.5 ${STATUS_STYLES[certification.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {certification.status}
              </span>
              {certification.expiresAt && (
                <span className="text-gray-500">expires {certification.expiresAt.slice(0, 10)}</span>
              )}
              {canManage && (
                <>
                  <input
                    type="date"
                    aria-label={`New expiry for ${certification.name}`}
                    className="rounded-md border border-gray-300 px-2 py-0.5"
                    onChange={(event) =>
                      run(() =>
                        updateCertification({
                          variables: {
                            organizationId,
                            id: certification.id,
                            expiresAt: event.target.value
                              ? new Date(event.target.value).toISOString()
                              : null,
                          },
                        }),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() =>
                      run(() =>
                        deleteCertification({ variables: { organizationId, id: certification.id } }),
                      )
                    }
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label="Certification name"
            value={form.name}
            placeholder="Food safety"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <select
            aria-label="Related skill"
            value={form.skillId}
            onChange={(event) => setForm((current) => ({ ...current, skillId: event.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">No skill</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-gray-500">
            Issued
            <input
              type="date"
              value={form.issuedAt}
              onChange={(event) => setForm((current) => ({ ...current, issuedAt: event.target.value }))}
              className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs text-gray-500">
            Expires
            <input
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
              className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                await createCertification({
                  variables: {
                    organizationId,
                    employeeId,
                    name: form.name,
                    skillId: form.skillId || null,
                    issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : null,
                    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                  },
                });
                setForm({ name: "", skillId: "", issuedAt: "", expiresAt: "" });
              })
            }
            className="rounded-md bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700"
          >
            Add certification
          </button>
        </div>
      )}
    </section>
  );
}
