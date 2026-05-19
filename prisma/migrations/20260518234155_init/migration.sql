-- CreateEnum
CREATE TYPE "IndustryProfile" AS ENUM ('SAAS', 'ECOMMERCE', 'FINTECH', 'LOCAL_SERVICES');

-- CreateEnum
CREATE TYPE "LinkPreference" AS ENUM ('DOFOLLOW', 'NOFOLLOW', 'EITHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'INVENTORY_LOADED', 'SCORED', 'FINALIZED');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "industryProfile" "IndustryProfile" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "configVersionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scoredAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryUpload" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "skippedHeaderRows" INTEGER NOT NULL,
    "rawCsv" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "inventoryUploadId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "domainRating" INTEGER,
    "traffic" INTEGER,
    "geo" TEXT,
    "price" DOUBLE PRECISION,
    "tat" TEXT,
    "linkType" TEXT,
    "ranking" TEXT,
    "contactEmail" TEXT,
    "niche" TEXT,
    "redFlags" TEXT[],
    "rawData" JSONB NOT NULL,
    "rowIndex" INTEGER NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "maxPossible" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "disqualifierReasons" TEXT[],
    "reasoning" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" SERIAL NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "configVersionId" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryUpload_campaignId_key" ON "InventoryUpload"("campaignId");

-- CreateIndex
CREATE INDEX "Domain_inventoryUploadId_idx" ON "Domain"("inventoryUploadId");

-- CreateIndex
CREATE INDEX "Score_campaignId_disqualified_total_idx" ON "Score"("campaignId", "disqualified", "total" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Score_campaignId_domainId_key" ON "Score"("campaignId", "domainId");

-- CreateIndex
CREATE INDEX "Selection_campaignId_included_idx" ON "Selection"("campaignId", "included");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_campaignId_domainId_key" ON "Selection"("campaignId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_versionNumber_key" ON "ConfigVersion"("versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveConfig_configVersionId_key" ON "ActiveConfig"("configVersionId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUpload" ADD CONSTRAINT "InventoryUpload_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_inventoryUploadId_fkey" FOREIGN KEY ("inventoryUploadId") REFERENCES "InventoryUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveConfig" ADD CONSTRAINT "ActiveConfig_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
