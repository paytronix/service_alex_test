export interface NotificationItem {
  id: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface ScheduleVersionItem {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface ScheduleChangeItem {
  id: string;
  assignmentId: string;
  changeType: string;
  date: string;
  previousEmployeeId: string | null;
  newEmployeeId: string | null;
  changedAt: string;
  changedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}
