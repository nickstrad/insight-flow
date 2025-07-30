/*
  Warnings:

  - You are about to drop the column `transcriptId` on the `TranscriptChunk` table. All the data in the column will be lost.
  - You are about to drop the `Transcript` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `videoId` to the `TranscriptChunk` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Transcript" DROP CONSTRAINT "Transcript_videoId_fkey";

-- DropForeignKey
ALTER TABLE "TranscriptChunk" DROP CONSTRAINT "TranscriptChunk_transcriptId_fkey";

-- AlterTable
ALTER TABLE "TranscriptChunk" DROP COLUMN "transcriptId",
ADD COLUMN     "videoId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "content" TEXT NOT NULL;

-- DropTable
DROP TABLE "Transcript";

-- AddForeignKey
ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
