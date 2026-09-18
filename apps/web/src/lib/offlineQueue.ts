import type { DocumentNode } from "@apollo/client";
import {
  ASSIGN_SHIFT_MUTATION,
  COPY_SHIFT_MUTATION,
  MOVE_SHIFT_MUTATION,
  REMOVE_SHIFT_MUTATION,
} from "./graphql";

export type QueuedMutationName = "assignShift" | "moveShift" | "copyShift" | "removeShift";

export interface QueuedMutation {
  id: string;
  name: QueuedMutationName;
  variables: Record<string, unknown>;
  queuedAt: string;
}

export interface FlushFailure {
  mutation: QueuedMutation;
  message: string;
}

const STORAGE_KEY = "shiftflow.offlineQueue";

export const QUEUED_MUTATION_DOCUMENTS: Record<QueuedMutationName, DocumentNode> = {
  assignShift: ASSIGN_SHIFT_MUTATION,
  moveShift: MOVE_SHIFT_MUTATION,
  copyShift: COPY_SHIFT_MUTATION,
  removeShift: REMOVE_SHIFT_MUTATION,
};

export function readQueue(): QueuedMutation[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(queue: QueuedMutation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueMutation(
  name: QueuedMutationName,
  variables: Record<string, unknown>,
): QueuedMutation[] {
  const queue = readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    variables,
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
  return queue;
}

export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}
