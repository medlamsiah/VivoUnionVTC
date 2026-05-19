-- CreateTable
CREATE TABLE "PlatformWeeklyRevenue" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverNameKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "weekValue" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reimbursements" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PlatformWeeklyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformWeeklyRevenue_platform_idx" ON "PlatformWeeklyRevenue"("platform");

-- CreateIndex
CREATE INDEX "PlatformWeeklyRevenue_driverName_idx" ON "PlatformWeeklyRevenue"("driverName");

-- CreateIndex
CREATE INDEX "PlatformWeeklyRevenue_weekValue_idx" ON "PlatformWeeklyRevenue"("weekValue");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformWeeklyRevenue_platform_driverNameKey_weekValue_key" ON "PlatformWeeklyRevenue"("platform", "driverNameKey", "weekValue");
