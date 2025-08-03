-- CreateTable
CREATE TABLE "Quota" (
    "userEmail" TEXT NOT NULL,
    "messagesLeft" INTEGER NOT NULL,
    "videoHoursLeft" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Quota_userEmail_key" ON "Quota"("userEmail");
