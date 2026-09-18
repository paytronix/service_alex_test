export interface SchedulerEmployee {
  id: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  departmentId: string | null;
}

export interface SchedulerRole {
  id: string;
  name: string;
  color: string | null;
}

export interface SchedulerTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  roleId?: string | null;
}

export interface SchedulerViolation {
  code: string;
  level: string;
  message: string;
}

export interface SchedulerAssignment {
  id: string;
  employeeId: string;
  shiftTemplateId: string;
  roleId: string | null;
  date: string;
  effectiveStartTime: string;
  effectiveEndTime: string;
  crossesMidnight: boolean;
  durationHours: number;
  breakMinutes: number;
  notes: string | null;
  employee: SchedulerEmployee;
  shiftTemplate: SchedulerTemplate;
  role: SchedulerRole | null;
  violations?: SchedulerViolation[];
}

export interface SchedulerRequirement {
  id: string;
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
}

export interface SchedulerCoverage {
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  assignedCount: number;
}

export interface SchedulerViewProps {
  assignments: SchedulerAssignment[];
  employees: SchedulerEmployee[];
  shiftTemplates: SchedulerTemplate[];
  roles: SchedulerRole[];
  weekDates: string[];
  coverage: SchedulerCoverage[];
  canEdit: boolean;
  onRemove: (assignment: SchedulerAssignment) => void;
}

export type ActiveDrag =
  | { type: "assignment"; assignment: SchedulerAssignment }
  | { type: "employee"; employee: SchedulerEmployee };

export interface DropTarget {
  type: "cell";
  date: string;
  shiftTemplateId: string;
  employeeId?: string;
}
