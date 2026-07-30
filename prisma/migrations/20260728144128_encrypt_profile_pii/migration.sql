/*
  Warnings:

  - A unique constraint covering the columns `[bvnHash]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ninHash]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bvnHash` to the `Profile` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Profile_bvn_key";

-- DropIndex
DROP INDEX "Profile_nin_key";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "bvnHash" TEXT NOT NULL,
ADD COLUMN     "ninHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_bvnHash_key" ON "Profile"("bvnHash");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_ninHash_key" ON "Profile"("ninHash");
