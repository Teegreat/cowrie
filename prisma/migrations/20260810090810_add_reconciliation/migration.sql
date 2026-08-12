-- CreateEnum
CREATE TYPE "ReconciliationDiscrepancyType" AS ENUM ('STUCK_WITHDRAWAL_RESOLVED', 'BALANCE_MISMATCH');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'RECONCILIATION_RUN_COMPLETED';

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationDiscrepancy" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "ReconciliationDiscrepancyType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationDiscrepancy_runId_idx" ON "ReconciliationDiscrepancy"("runId");

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
