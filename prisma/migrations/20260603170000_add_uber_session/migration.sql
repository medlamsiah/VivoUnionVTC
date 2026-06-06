-- CreateTable
CREATE TABLE "UberSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'uber',
    "cookieCiphertext" TEXT,
    "csrfTokenCiphertext" TEXT,
    "orgUuid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "lastValidatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UberSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UberSession_provider_key" ON "UberSession"("provider");

-- CreateIndex
CREATE INDEX "UberSession_status_idx" ON "UberSession"("status");

-- CreateIndex
CREATE INDEX "UberSession_updatedAt_idx" ON "UberSession"("updatedAt");
