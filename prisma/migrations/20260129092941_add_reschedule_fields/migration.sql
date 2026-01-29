-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "lastRescheduledAt" TIMESTAMP(3),
ADD COLUMN     "lastRescheduledFrom" TEXT,
ADD COLUMN     "lastRescheduledTo" TEXT,
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rescheduleReason" TEXT;
