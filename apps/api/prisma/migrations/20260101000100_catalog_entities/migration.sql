-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#3B82F6',
ADD COLUMN     "hourlyRate" DECIMAL(65,30),
ADD COLUMN     "maxLoad" INTEGER;

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "shift_templates" ADD COLUMN     "crossesMidnight" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_name_organizationId_key" ON "shift_templates"("name", "organizationId");

