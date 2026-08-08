-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED');

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountMinorUnits" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountMinorUnits" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "destinationAccountNumber" TEXT NOT NULL,
    "destinationBankCode" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "reservationTransactionId" TEXT NOT NULL,
    "resolutionTransactionId" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_externalReference_key" ON "Deposit"("externalReference");

-- CreateIndex
CREATE INDEX "Deposit_walletId_idx" ON "Deposit"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_idempotencyKey_key" ON "Withdrawal"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_externalReference_key" ON "Withdrawal"("externalReference");

-- CreateIndex
CREATE INDEX "Withdrawal_walletId_idx" ON "Withdrawal"("walletId");

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
