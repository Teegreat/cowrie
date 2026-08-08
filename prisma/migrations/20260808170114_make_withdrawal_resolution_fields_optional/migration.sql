-- AlterTable
ALTER TABLE "Withdrawal" ALTER COLUMN "externalReference" DROP NOT NULL,
ALTER COLUMN "resolutionTransactionId" DROP NOT NULL;
