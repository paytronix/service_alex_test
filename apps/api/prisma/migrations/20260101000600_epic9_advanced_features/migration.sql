-- CreateEnum
CREATE TYPE "ShiftSwapStatus" AS ENUM ('PENDING', 'ACCEPTED_BY_TARGET', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttachmentEntityType" AS ENUM ('SHIFT_ASSIGNMENT', 'SCHEDULE', 'EMPLOYEE');

-- DropIndex
DROP INDEX "schedules_organizationId_weekStartDate_key";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "calendarId" TEXT,
ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "shift_assignments" ADD COLUMN     "calendarId" TEXT;

-- AlterTable
ALTER TABLE "shift_requirements" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "week_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "calendarId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "week_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_shift_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weekTemplateId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "roleId" TEXT,
    "employeeId" TEXT,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_shift_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "status" "ShiftSwapStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_comments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "scheduleId" TEXT,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "AttachmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_organizationId_idx" ON "locations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_organizationId_key" ON "locations"("name", "organizationId");

-- CreateIndex
CREATE INDEX "calendars_organizationId_locationId_idx" ON "calendars"("organizationId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_name_organizationId_key" ON "calendars"("name", "organizationId");

-- CreateIndex
CREATE INDEX "week_templates_organizationId_idx" ON "week_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "week_templates_name_organizationId_key" ON "week_templates"("name", "organizationId");

-- CreateIndex
CREATE INDEX "recurring_shift_rules_organizationId_dayOfWeek_idx" ON "recurring_shift_rules"("organizationId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "recurring_shift_rules_weekTemplateId_idx" ON "recurring_shift_rules"("weekTemplateId");

-- CreateIndex
CREATE INDEX "shift_swap_requests_organizationId_status_idx" ON "shift_swap_requests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "shift_swap_requests_assignmentId_idx" ON "shift_swap_requests"("assignmentId");

-- CreateIndex
CREATE INDEX "shift_swap_requests_targetEmployeeId_status_idx" ON "shift_swap_requests"("targetEmployeeId", "status");

-- CreateIndex
CREATE INDEX "shift_comments_organizationId_createdAt_idx" ON "shift_comments"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_comments_assignmentId_createdAt_idx" ON "shift_comments"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_comments_scheduleId_createdAt_idx" ON "shift_comments"("scheduleId", "createdAt");

-- CreateIndex
CREATE INDEX "attachments_organizationId_entityType_entityId_idx" ON "attachments"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "schedules_organizationId_locationId_idx" ON "schedules"("organizationId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_organizationId_weekStartDate_locationId_calendarI_key" ON "schedules"("organizationId", "weekStartDate", "locationId", "calendarId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_templates" ADD CONSTRAINT "week_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_templates" ADD CONSTRAINT "week_templates_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_templates" ADD CONSTRAINT "week_templates_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_shift_rules" ADD CONSTRAINT "recurring_shift_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_shift_rules" ADD CONSTRAINT "recurring_shift_rules_weekTemplateId_fkey" FOREIGN KEY ("weekTemplateId") REFERENCES "week_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_shift_rules" ADD CONSTRAINT "recurring_shift_rules_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_shift_rules" ADD CONSTRAINT "recurring_shift_rules_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_shift_rules" ADD CONSTRAINT "recurring_shift_rules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_comments" ADD CONSTRAINT "shift_comments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_comments" ADD CONSTRAINT "shift_comments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_comments" ADD CONSTRAINT "shift_comments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_comments" ADD CONSTRAINT "shift_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

