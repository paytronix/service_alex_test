-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('WORKING', 'VACATION', 'SICK', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('UNAVAILABLE', 'AVAILABLE', 'AVAILABLE_AFTER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('VACATION', 'DAY_OFF', 'SICK', 'UNPAID', 'OTHER');

-- AlterTable
ALTER TABLE "availabilities" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "availableFrom" TEXT,
ADD COLUMN     "type" "AvailabilityType" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "externalUserId",
DROP COLUMN "isActive",
ADD COLUMN     "maxConsecutiveShifts" INTEGER,
ADD COLUMN     "maxHoursPerWeek" INTEGER,
ADD COLUMN     "minRestHours" INTEGER,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "status" "EmployeeStatus" NOT NULL DEFAULT 'WORKING',
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "leave_requests" DROP COLUMN "reviewedBy",
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "type" "LeaveType" NOT NULL DEFAULT 'VACATION',
DROP COLUMN "status",
ADD COLUMN     "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "skills" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropEnum
DROP TYPE "LeaveRequestStatus";

-- CreateIndex
CREATE UNIQUE INDEX "availabilities_employeeId_dayOfWeek_key" ON "availabilities"("employeeId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_organizationId_key" ON "employees"("userId", "organizationId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

