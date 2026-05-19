/*
  Warnings:

  - You are about to drop the column `niche` on the `Domain` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Domain` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Domain" DROP COLUMN "niche",
DROP COLUMN "price",
ADD COLUMN     "complementary" TEXT,
ADD COLUMN     "gpPrice" DOUBLE PRECISION,
ADD COLUMN     "indirect" TEXT,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liPrice" DOUBLE PRECISION,
ADD COLUMN     "mainNiche" TEXT,
ADD COLUMN     "nicheRaw" TEXT;
