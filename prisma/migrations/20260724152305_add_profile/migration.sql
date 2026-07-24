-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "kycTier" "KycTier" NOT NULL DEFAULT 'TIER_1',
    "bvn" TEXT,
    "nin" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_phoneNumber_key" ON "Profile"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_bvn_key" ON "Profile"("bvn");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_nin_key" ON "Profile"("nin");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
