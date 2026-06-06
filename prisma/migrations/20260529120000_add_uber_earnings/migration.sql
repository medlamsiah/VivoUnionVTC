-- CreateTable
CREATE TABLE "UberEarning" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reimbursements" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UberEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UberEarning_externalId_key" ON "UberEarning"("externalId");

-- CreateIndex
CREATE INDEX "UberEarning_driverName_idx" ON "UberEarning"("driverName");

-- CreateIndex
CREATE INDEX "UberEarning_periodStart_periodEnd_idx" ON "UberEarning"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "UberEarning_updatedAt_idx" ON "UberEarning"("updatedAt");
