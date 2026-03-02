-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "blockedDates" JSONB NOT NULL DEFAULT '[]';
