/*
  Warnings:

  - You are about to drop the column `duration` on the `interviews` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `interviews` table. All the data in the column will be lost.
  - The `status` column on the `interviews` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `endTime` to the `interviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `interviews` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED_BY_CANDIDATE', 'CANCELLED_BY_INTERVIEWER', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'REJECTED');

-- DropIndex
DROP INDEX "interviews_candidateId_key";

-- DropIndex
DROP INDEX "interviews_scheduledAt_idx";

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "interviews" DROP COLUMN "duration",
DROP COLUMN "scheduledAt",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "panelId" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED';

-- CreateIndex
CREATE INDEX "candidates_status_idx" ON "candidates"("status");

-- CreateIndex
CREATE INDEX "interviews_startTime_idx" ON "interviews"("startTime");

-- CreateIndex
CREATE INDEX "interviews_status_idx" ON "interviews"("status");

-- CreateIndex
CREATE INDEX "interviews_candidateId_idx" ON "interviews"("candidateId");
