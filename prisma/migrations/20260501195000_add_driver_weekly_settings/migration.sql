-- CreateTable
CREATE TABLE "DriverWeeklySetting" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverNameKey" TEXT NOT NULL,
    "weekValue" TEXT NOT NULL,
    "vehicleType" TEXT,
    "location" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acompte" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DriverWeeklySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationTypePricing" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationTypePricing_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "DriverWeeklySetting_driverName_idx" ON "DriverWeeklySetting"("driverName");

-- CreateIndex
CREATE INDEX "DriverWeeklySetting_weekValue_idx" ON "DriverWeeklySetting"("weekValue");

-- CreateIndex
CREATE UNIQUE INDEX "DriverWeeklySetting_driverNameKey_weekValue_key" ON "DriverWeeklySetting"("driverNameKey", "weekValue");

-- CreateIndex
CREATE INDEX "LocationTypePricing_sortOrder_idx" ON "LocationTypePricing"("sortOrder");
