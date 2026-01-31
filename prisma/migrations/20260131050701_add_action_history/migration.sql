-- CreateTable
CREATE TABLE "action_history" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "action_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_history_timestamp_idx" ON "action_history"("timestamp");

-- CreateIndex
CREATE INDEX "action_history_actionType_idx" ON "action_history"("actionType");
