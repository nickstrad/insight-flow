CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Video"(
    "id" text NOT NULL,
    "youtubeId" text NOT NULL,
    "channelHandle" text NOT NULL,
    "title" text NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL,
    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript"(
    "id" text NOT NULL,
    "content" text NOT NULL,
    "videoId" text NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL,
    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptChunk"(
    "id" text NOT NULL,
    "timestamp" text NOT NULL,
    "text" text NOT NULL,
    "embedding" vector,
    "transcriptId" text NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_youtubeId_key" ON "Video"("youtubeId");

-- AddForeignKey
ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptChunk"
    ADD CONSTRAINT "TranscriptChunk_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

