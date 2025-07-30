-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING';
