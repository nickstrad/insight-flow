import { prisma } from "@/db";
import { NotificationType, Video } from "@/generated/prisma";

export async function createNotification({
  type,
  message,
}: {
  type: NotificationType;
  message: string;
}) {
  return prisma.notification.create({
    data: {
      type,
      message,
      read: false,
    },
  });
}

export async function getNotifications(options?: {
  read?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}) {
  const where: { read?: boolean; type?: NotificationType } = {};

  if (options?.read !== undefined) {
    where.read = options.read;
  }

  if (options?.type) {
    where.type = options.type;
  }

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit,
    skip: options?.offset,
  });
}

export async function getUnreadNotificationCount() {
  return prisma.notification.count({
    where: {
      read: false,
    },
  });
}

export async function markNotificationAsRead(notificationId: string) {
  return prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      read: true,
    },
  });
}

export async function markAllNotificationsAsRead() {
  return prisma.notification.updateMany({
    where: {
      read: false,
    },
    data: {
      read: true,
    },
  });
}

export async function deleteNotification(notificationId: string) {
  const existingNotification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existingNotification) {
    throw new Error("Notification not found");
  }

  await prisma.notification.delete({
    where: {
      id: notificationId,
    },
  });

  return {
    success: true,
    deletedNotification: existingNotification,
  };
}

export async function batchDeleteNotifications(notificationIds: string[]) {
  if (notificationIds.length === 0) {
    throw new Error("No notification IDs provided");
  }

  const { count } = await prisma.notification.deleteMany({
    where: { id: { in: notificationIds } },
  });

  return { success: true, deletedCount: count };
}

export async function deleteAllReadNotifications() {
  const { count } = await prisma.notification.deleteMany({
    where: { read: true },
  });
  return { success: true, deletedCount: count };
}

export async function deleteAllNotifications() {
  const { count } = await prisma.notification.deleteMany();
  return { success: true, deletedCount: count };
}

export async function createTranscriptionNotifications({
  transcriptionSuccesses,
  transcriptionFailures,
  embeddingSuccesses,
  embeddingFailures,
}: {
  transcriptionSuccesses: Video[];
  transcriptionFailures: Video[];
  embeddingSuccesses: Video[];
  embeddingFailures: Video[];
}) {
  const notificationsToCreate: { type: NotificationType; message: string }[] =
    [];

  if (transcriptionSuccesses.length > 0) {
    const videoTitles = transcriptionSuccesses
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3);

    const message =
      transcriptionSuccesses.length === 1
        ? `Successfully transcribed: ${videoTitles[0]}`
        : transcriptionSuccesses.length <= 3
          ? `Successfully transcribed ${
              transcriptionSuccesses.length
            } videos: ${videoTitles.join(", ")}`
          : `Successfully transcribed ${
              transcriptionSuccesses.length
            } videos including: ${videoTitles.join(", ")} and ${
              transcriptionSuccesses.length - 3
            } more`;

    notificationsToCreate.push({
      type: NotificationType.TRANSCRIPTION_SUCCESS,
      message,
    });
  }

  if (transcriptionFailures.length > 0) {
    const videoTitles = transcriptionFailures
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3);

    const message =
      transcriptionFailures.length === 1
        ? `Failed to transcribe: ${videoTitles[0]}. Please try again or check if the video is accessible.`
        : transcriptionFailures.length <= 3
          ? `Failed to transcribe ${
              transcriptionFailures.length
            } videos: ${videoTitles.join(
              ", "
            )}. Please try again or check if the videos are accessible.`
          : `Failed to transcribe ${
              transcriptionFailures.length
            } videos including: ${videoTitles.join(", ")} and ${
              transcriptionFailures.length - 3
            } more. Please try again or check if the videos are accessible.`;

    notificationsToCreate.push({
      type: NotificationType.TRANSCRIPTION_ERROR,
      message,
    });
  }

  if (embeddingSuccesses.length > 0) {
    const videoTitles = embeddingSuccesses
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3);

    const message =
      embeddingSuccesses.length === 1
        ? `Successfully processed embeddings for: ${videoTitles[0]}. Video is now ready for AI chat.`
        : embeddingSuccesses.length <= 3
          ? `Successfully processed embeddings for ${
              embeddingSuccesses.length
            } videos: ${videoTitles.join(
              ", "
            )}. Videos are now ready for AI chat.`
          : `Successfully processed embeddings for ${
              embeddingSuccesses.length
            } videos including: ${videoTitles.join(", ")} and ${
              embeddingSuccesses.length - 3
            } more. Videos are now ready for AI chat.`;

    notificationsToCreate.push({
      type: NotificationType.EMBEDDING_SUCCESS,
      message,
    });
  }

  if (embeddingFailures.length > 0) {
    const videoTitles = embeddingFailures
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3);

    const message =
      embeddingFailures.length === 1
        ? `Failed to process embeddings for: ${videoTitles[0]}. Transcription completed but AI chat may not work properly.`
        : embeddingFailures.length <= 3
          ? `Failed to process embeddings for ${
              embeddingFailures.length
            } videos: ${videoTitles.join(
              ", "
            )}. Transcriptions completed but AI chat may not work properly for these videos.`
          : `Failed to process embeddings for ${
              embeddingFailures.length
            } videos including: ${videoTitles.join(", ")} and ${
              embeddingFailures.length - 3
            } more. Transcriptions completed but AI chat may not work properly for these videos.`;

    notificationsToCreate.push({
      type: NotificationType.EMBEDDING_ERROR,
      message,
    });
  }

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate,
    });

    console.log(`Created ${notificationsToCreate.length} notification(s)`);
  }

  return {
    created: notificationsToCreate.length,
    notifications: notificationsToCreate,
  };
}
