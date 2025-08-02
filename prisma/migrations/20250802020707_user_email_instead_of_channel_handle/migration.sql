/*
  Warnings:

  - You are about to drop the column `channelHandle` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the column `channelHandle` on the `Video` table. All the data in the column will be lost.
  - Added the required column `userEmail` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TranscriptChunk" DROP CONSTRAINT "TranscriptChunk_videoId_fkey";

-- AlterTable
ALTER TABLE "Chat" DROP COLUMN "channelHandle";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "channelHandle",
ADD COLUMN     "userEmail" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
