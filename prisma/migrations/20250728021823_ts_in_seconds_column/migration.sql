/*
  Warnings:

  - You are about to drop the column `timestamp` on the `TranscriptChunk` table. All the data in the column will be lost.
  - Added the required column `timestampInSeconds` to the `TranscriptChunk` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TranscriptChunk" DROP COLUMN "timestamp",
ADD COLUMN     "timestampInSeconds" INTEGER NOT NULL;
