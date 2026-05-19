-- CreateTable
CREATE TABLE "UberDriverRevenueSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "driverUuid" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverNameKey" TEXT NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netTripPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reimbursements" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payouts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankTransfers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thirdPartyPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tolls" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postTripAdjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAdjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "UberDriverRevenueSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UberDriverRevenueSnapshot_driverName_idx" ON "UberDriverRevenueSnapshot"("driverName");

-- CreateIndex
CREATE INDEX "UberDriverRevenueSnapshot_snapshotDate_idx" ON "UberDriverRevenueSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "UberDriverRevenueSnapshot_periodStart_periodEnd_idx" ON "UberDriverRevenueSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UberDriverRevenueSnapshot_snapshotDate_periodStart_periodEn_key" ON "UberDriverRevenueSnapshot"("snapshotDate", "periodStart", "periodEnd", "driverUuid");
