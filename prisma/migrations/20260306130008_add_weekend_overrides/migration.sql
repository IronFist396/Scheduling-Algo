-- CreateTable
CREATE TABLE "weekend_overrides" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startSlot" TEXT NOT NULL,
    "endSlot" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekend_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekend_overrides_date_key" ON "weekend_overrides"("date");

-- CreateIndex
CREATE INDEX "weekend_overrides_date_idx" ON "weekend_overrides"("date");
