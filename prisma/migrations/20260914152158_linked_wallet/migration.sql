-- CreateTable
CREATE TABLE "LinkedWallet" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "address" TEXT NOT NULL,
    "linkMethod" "LinkMethod" NOT NULL DEFAULT 'dm',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedWallet_telegramUserId_key" ON "LinkedWallet"("telegramUserId");
