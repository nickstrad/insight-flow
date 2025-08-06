/*
  Warnings:

  - The values [PROCESSING,FAILED] on the enum `TranscriptionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TranscriptionStatus_new" AS ENUM ('PENDING', 'TRANSCRIBE_ERROR', 'EMBEDDING_ERROR', 'COMPLETED');
ALTER TABLE "Video" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Video" ALTER COLUMN "status" TYPE "TranscriptionStatus_new" USING ("status"::text::"TranscriptionStatus_new");
ALTER TYPE "TranscriptionStatus" RENAME TO "TranscriptionStatus_old";
ALTER TYPE "TranscriptionStatus_new" RENAME TO "TranscriptionStatus";
DROP TYPE "TranscriptionStatus_old";
ALTER TABLE "Video" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
