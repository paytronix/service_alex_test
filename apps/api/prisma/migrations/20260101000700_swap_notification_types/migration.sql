-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SWAP_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SWAP_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'SWAP_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SWAP_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_COMMENT_ADDED';

