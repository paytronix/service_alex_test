import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import {
  ATTACHMENTS_QUERY,
  CREATE_SHIFT_COMMENT_MUTATION,
  CREATE_SHIFT_SWAP_MUTATION,
  DELETE_ATTACHMENT_MUTATION,
  DELETE_SHIFT_COMMENT_MUTATION,
  SHIFT_COMMENTS_QUERY,
} from "../../lib/graphql";
import { attachmentDownloadUrl, uploadAttachment } from "../../lib/attachments";
import type { SchedulerAssignment, SchedulerEmployee } from "./types";

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ShiftDetailPanelProps {
  organizationId: string;
  assignment: SchedulerAssignment;
  employees: SchedulerEmployee[];
  canUploadAttachments: boolean;
  canRequestSwap: boolean;
  onClose: () => void;
}

export function ShiftDetailPanel({
  organizationId,
  assignment,
  employees,
  canUploadAttachments,
  canRequestSwap,
  onClose,
}: ShiftDetailPanelProps) {
  const [text, setText] = useState("");
  const [swapTargetId, setSwapTargetId] = useState("");
  const [swapMessage, setSwapMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commentVariables = { organizationId, assignmentId: assignment.id };
  const attachmentVariables = {
    organizationId,
    entityType: "SHIFT_ASSIGNMENT",
    entityId: assignment.id,
  };
  const commentsQuery = useQuery<{ shiftComments: Comment[] }>(SHIFT_COMMENTS_QUERY, {
    variables: commentVariables,
  });
  const attachmentsQuery = useQuery<{ attachments: Attachment[] }>(ATTACHMENTS_QUERY, {
    variables: attachmentVariables,
  });
  const [createComment] = useMutation(CREATE_SHIFT_COMMENT_MUTATION, {
    refetchQueries: [{ query: SHIFT_COMMENTS_QUERY, variables: commentVariables }],
  });
  const [deleteComment] = useMutation(DELETE_SHIFT_COMMENT_MUTATION, {
    refetchQueries: [{ query: SHIFT_COMMENTS_QUERY, variables: commentVariables }],
  });
  const [deleteAttachment] = useMutation(DELETE_ATTACHMENT_MUTATION, {
    refetchQueries: [{ query: ATTACHMENTS_QUERY, variables: attachmentVariables }],
  });
  const [createSwap] = useMutation(CREATE_SHIFT_SWAP_MUTATION);

  const run = async (action: () => Promise<unknown>, message?: string): Promise<void> => {
    setError(null);
    setStatus(null);
    try {
      await action();
      if (message) setStatus(message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action failed");
    }
  };

  const swapCandidates = employees.filter((employee) => employee.id !== assignment.employeeId);

  return (
    <aside className="space-y-4 rounded border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {assignment.employee.firstName} {assignment.employee.lastName} ·{" "}
            {assignment.shiftTemplate.name}
          </h2>
          <p className="text-sm text-gray-600">
            {assignment.date.slice(0, 10)} · {assignment.effectiveStartTime}–
            {assignment.effectiveEndTime}
          </p>
        </div>
        <button type="button" className="text-sm underline" onClick={onClose}>
          Close
        </button>
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {status && <p className="rounded bg-green-50 p-2 text-sm text-green-700">{status}</p>}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Comments</h3>
        {commentsQuery.loading && <p className="text-sm text-gray-600">Loading comments…</p>}
        <ul className="space-y-2">
          {(commentsQuery.data?.shiftComments ?? []).map((comment) => (
            <li key={comment.id} className="rounded bg-gray-50 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{comment.authorName}</strong>
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() =>
                    void run(() => deleteComment({ variables: { organizationId, id: comment.id } }))
                  }
                >
                  Delete
                </button>
              </div>
              <p>{comment.text}</p>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-2 py-1 text-sm"
            placeholder="Banquet today, please arrive early"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="button"
            className="rounded bg-primary-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={!text.trim()}
            onClick={() =>
              void run(async () => {
                await createComment({
                  variables: { organizationId, assignmentId: assignment.id, text: text.trim() },
                });
                setText("");
              })
            }
          >
            Comment
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Attachments</h3>
        <ul className="space-y-1 text-sm">
          {(attachmentsQuery.data?.attachments ?? []).map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-2">
              <a
                className="text-primary-700 underline"
                href={attachmentDownloadUrl(attachment.id, organizationId)}
                target="_blank"
                rel="noreferrer"
              >
                {attachment.fileName}
              </a>
              {canUploadAttachments && (
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() =>
                    void run(() =>
                      deleteAttachment({ variables: { organizationId, id: attachment.id } }),
                    )
                  }
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
        {canUploadAttachments && (
          <input
            type="file"
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void run(async () => {
                await uploadAttachment({
                  organizationId,
                  entityType: "SHIFT_ASSIGNMENT",
                  entityId: assignment.id,
                  file,
                });
                await attachmentsQuery.refetch();
              }, "File uploaded");
            }}
          />
        )}
      </section>

      {canRequestSwap && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Request a swap</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Offer to</span>
              <select
                className="rounded border px-2 py-1"
                value={swapTargetId}
                onChange={(event) => setSwapTargetId(event.target.value)}
              >
                <option value="">Select an employee…</option>
                {swapCandidates.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Optional message"
              value={swapMessage}
              onChange={(event) => setSwapMessage(event.target.value)}
            />
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              disabled={!swapTargetId}
              onClick={() =>
                void run(async () => {
                  await createSwap({
                    variables: {
                      organizationId,
                      assignmentId: assignment.id,
                      targetEmployeeId: swapTargetId,
                      message: swapMessage.trim() || null,
                    },
                  });
                  setSwapTargetId("");
                  setSwapMessage("");
                }, "Swap request sent")
              }
            >
              Request swap
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
