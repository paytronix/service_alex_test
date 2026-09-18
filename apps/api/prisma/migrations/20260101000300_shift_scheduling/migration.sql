/*
  Warnings:

  - You are about to drop the column `endDate` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `schedules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,weekStartDate]` on the table `schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `weekStartDate` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `shift_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftTemplateId` to the `shift_assignments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "endDate",
DROP COLUMN "name",
DROP COLUMN "startDate",
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekStartDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "shift_assignments" ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "shiftTemplateId" TEXT NOT NULL,
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL;

-- CreateTable
CREATE TABLE "shift_requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "schedule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_requirements_scheduleId_date_shiftTemplateId_roleId_key" ON "shift_requirements"("scheduleId", "date", "shiftTemplateId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_versions_scheduleId_version_key" ON "schedule_versions"("scheduleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_organizationId_weekStartDate_key" ON "schedules"("organizationId", "weekStartDate");

-- CreateIndex
CREATE INDEX "shift_assignments_scheduleId_idx" ON "shift_assignments"("scheduleId");

-- CreateIndex
CREATE INDEX "shift_assignments_employeeId_date_idx" ON "shift_assignments"("employeeId", "date");

-- CreateIndex
CREATE INDEX "shift_assignments_organizationId_idx" ON "shift_assignments"("organizationId");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
