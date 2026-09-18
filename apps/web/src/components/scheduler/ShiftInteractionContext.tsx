import { createContext, useContext, type ReactNode } from "react";
import type { SchedulerAssignment } from "./types";

export interface ShiftInteraction {
  selectedIds: string[];
  toggleSelected: (assignmentId: string) => void;
  openDetails: (assignment: SchedulerAssignment) => void;
}

const noop: ShiftInteraction = {
  selectedIds: [],
  toggleSelected: () => undefined,
  openDetails: () => undefined,
};

const ShiftInteractionContext = createContext<ShiftInteraction>(noop);

export function ShiftInteractionProvider({
  value,
  children,
}: {
  value: ShiftInteraction;
  children: ReactNode;
}) {
  return (
    <ShiftInteractionContext.Provider value={value}>{children}</ShiftInteractionContext.Provider>
  );
}

export function useShiftInteraction(): ShiftInteraction {
  return useContext(ShiftInteractionContext);
}
