-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "channelHandles" TEXT[],
ADD COLUMN     "playlistIds" TEXT[];

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "playlistTitle" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;
