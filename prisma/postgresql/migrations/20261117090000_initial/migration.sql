-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ownerHash" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "plan" TEXT NOT NULL DEFAULT 'FREE',

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "executionMode" TEXT NOT NULL DEFAULT 'STATIC',
    "viewport" TEXT NOT NULL DEFAULT 'DESKTOP',
    "purchasePath" TEXT NOT NULL DEFAULT 'CART',
    "targetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportPath" TEXT,
    "reportJson" TEXT,
    "shopId" TEXT,
    "startedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT,
    "phaseResultsJson" TEXT NOT NULL DEFAULT '{}',
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "credentialCiphertext" TEXT,
    "baselineScanId" TEXT,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "provider" TEXT,
    "model" TEXT,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "resultJson" TEXT,
    "usageJson" TEXT,
    "operatorLabelsJson" TEXT,
    "labeledAt" TIMESTAMP(3),
    "labelSource" TEXT,
    "error" TEXT,

    CONSTRAINT "AiReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" SERIAL NOT NULL,
    "scanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scan_baselineScanId_idx" ON "Scan"("baselineScanId");

-- CreateIndex
CREATE INDEX "Scan_status_createdAt_idx" ON "Scan"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiReview_scanId_key" ON "AiReview"("scanId");

-- CreateIndex
CREATE INDEX "AiReview_status_requestedAt_idx" ON "AiReview"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "Finding_scanId_idx" ON "Finding"("scanId");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_baselineScanId_fkey" FOREIGN KEY ("baselineScanId") REFERENCES "Scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
