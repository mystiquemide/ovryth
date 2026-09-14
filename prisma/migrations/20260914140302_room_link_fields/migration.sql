/*
  Warnings:

  - A unique constraint covering the columns `[linkCode]` on the table `Room` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "linkCode" TEXT,
ALTER COLUMN "telegramChatId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Room_linkCode_key" ON "Room"("linkCode");
