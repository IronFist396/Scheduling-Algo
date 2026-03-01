-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "reviewer1Id" TEXT,
ADD COLUMN     "reviewer2Id" TEXT;

-- CreateTable
CREATE TABLE "reviewers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "availability" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviewers_email_key" ON "reviewers"("email");

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_reviewer1Id_fkey" FOREIGN KEY ("reviewer1Id") REFERENCES "reviewers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_reviewer2Id_fkey" FOREIGN KEY ("reviewer2Id") REFERENCES "reviewers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
