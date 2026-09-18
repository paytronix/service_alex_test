-- CreateEnum
CREATE TYPE "ScheduleChangeType" AS ENUM ('CREATED', 'MOVED', 'REPLACED', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SHIFT_ASSIGNED', 'SHIFT_CHANGED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'SCHEDULE_PUBLISHED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING';

-- Convert the free-form type column in place so existing rows survive; values
-- outside the new enum are mapped to SHIFT_CHANGED.
ALTER TABLE "notifications"
ALTER COLUMN "type" TYPE "NotificationType" USING (
    CASE
        WHEN "type" IN (
            'SHIFT_ASSIGNED',
            'SHIFT_CHANGED',
            'REQUEST_APPROVED',
            'REQUEST_REJECTED',
            'SCHEDULE_PUBLISHED'
        ) THEN "type"::"NotificationType"
        ELSE 'SHIFT_CHANGED'::"NotificationType"
    END
);

-- CreateTable
CREATE TABLE "shift_assignment_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "changeType" "ScheduleChangeType" NOT NULL,
    "date" DATE NOT NULL,
    "previousEmployeeId" TEXT,
    "newEmployeeId" TEXT,
    "changedById" TEXT,
    "metadata" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_assignment_history_scheduleId_changedAt_idx" ON "shift_assignment_history"("scheduleId", "changedAt");

-- CreateIndex
CREATE INDEX "shift_assignment_history_organizationId_idx" ON "shift_assignment_history"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_action_idx" ON "audit_logs"("organizationId", "action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "notifications_recipientId_organizationId_createdAt_idx" ON "notifications"("recipientId", "organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_organizationId_status_idx" ON "notifications"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "shift_assignment_history" ADD CONSTRAINT "shift_assignment_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment_history" ADD CONSTRAINT "shift_assignment_history_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment_history" ADD CONSTRAINT "shift_assignment_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
