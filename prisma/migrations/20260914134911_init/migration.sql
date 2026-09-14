-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('pending_onchain', 'active', 'paused', 'revoked', 'expired', 'inactive_bot');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('queued', 'sent', 'confirmed', 'reverted', 'failed');

-- CreateEnum
CREATE TYPE "LinkMethod" AS ENUM ('dm', 'deeplink');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('payout', 'status', 'hold_expiry');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "ownerAccount" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'pending_onchain',
    "external" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "permissionJson" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "allowanceUsdc" BIGINT NOT NULL,
    "periodSeconds" INTEGER NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "approvedOnchain" BOOLEAN NOT NULL DEFAULT false,
    "lastStatusJson" JSONB,
    "lastStatusAt" TIMESTAMP(3),

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RulesVersion" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "categories" JSONB NOT NULL,
    "memberWeeklyCapUsdc" BIGINT NOT NULL,
    "roomDailyCapUsdc" BIGINT NOT NULL,
    "minAccountAgeDays" INTEGER NOT NULL,
    "minTenureDays" INTEGER NOT NULL,
    "freeText" TEXT NOT NULL DEFAULT '',
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RulesVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "telegramMessageId" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approxAccountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "publicRefusalsToday" INTEGER NOT NULL DEFAULT 0,
    "paidThisWeekUsdc" BIGINT NOT NULL DEFAULT 0,
    "seeded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkMethod" "LinkMethod" NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "telegramMessageId" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "simhash" TEXT NOT NULL,
    "editedAfterDecision" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prefilterResult" JSONB,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rulesVersionId" TEXT NOT NULL,
    "modelOutput" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "finalAmountUsdc" BIGINT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonText" TEXT NOT NULL,
    "policyNotes" JSONB,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amountUsdc" BIGINT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'queued',
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refusal" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "repliedMessageId" BIGINT,

    CONSTRAINT "Refusal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountUsdc" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "refId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Room_telegramChatId_key" ON "Room"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_roomId_key" ON "Permission"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_hash_key" ON "Permission"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "RulesVersion_roomId_version_key" ON "RulesVersion"("roomId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Question_roomId_telegramMessageId_key" ON "Question"("roomId", "telegramMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_roomId_telegramUserId_key" ON "Member"("roomId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_memberId_key" ON "Wallet"("memberId");

-- CreateIndex
CREATE INDEX "Message_roomId_createdAt_idx" ON "Message"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_roomId_telegramMessageId_key" ON "Message"("roomId", "telegramMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_candidateId_key" ON "Decision"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_decisionId_key" ON "Payout"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Refusal_decisionId_key" ON "Refusal"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_decisionId_key" ON "Hold"("decisionId");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RulesVersion" ADD CONSTRAINT "RulesVersion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_rulesVersionId_fkey" FOREIGN KEY ("rulesVersionId") REFERENCES "RulesVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refusal" ADD CONSTRAINT "Refusal_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
