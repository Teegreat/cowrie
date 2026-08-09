/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phoneNumber` to the `Wallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TRANSFER_SENT';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "phoneNumber" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "senderWalletId" TEXT NOT NULL,
    "recipientWalletId" TEXT NOT NULL,
    "amountMinorUnits" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "narration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transfer_senderWalletId_idx" ON "Transfer"("senderWalletId");

-- CreateIndex
CREATE INDEX "Transfer_recipientWalletId_idx" ON "Transfer"("recipientWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_phoneNumber_key" ON "Wallet"("phoneNumber");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_senderWalletId_fkey" FOREIGN KEY ("senderWalletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_recipientWalletId_fkey" FOREIGN KEY ("recipientWalletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
