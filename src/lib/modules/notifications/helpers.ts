import { prisma } from "@/db";
import { NotificationType, Video } from "@/generated/prisma";

// Create a new notification
export async function createNotification({
  userEmail,
  type,
  message,
}: {
  userEmail: string;
  type: NotificationType;
  message: string;
}) {
  return prisma.notification.create({
    data: {
      userEmail,
      type,
      message,
      read: false,
    },
  });
}

// Get all notifications for a user with optional filtering
export async function getNotificationsForUser(
  userEmail: string,
  options?: {
    read?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  }
) {
  const where: { userEmail: string; read?: boolean; type?: NotificationType } =
    { userEmail };

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

// Get unread notification count for a user
export async function getUnreadNotificationCount(userEmail: string) {
  return prisma.notification.count({
    where: {
      userEmail,
      read: false,
    },
  });
}

// Mark a notification as read
export async function markNotificationAsRead(
  notificationId: string,
  userEmail: string
) {
  // First verify the notification exists and belongs to the user
  const existingNotification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userEmail,
    },
  });

  if (!existingNotification) {
    throw new Error(
      "Notification not found or you don't have permission to edit it"
    );
  }

  return prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      read: true,
    },
  });
}

// Mark all notifications as read for a user
export async function markAllNotificationsAsRead(userEmail: string) {
  return prisma.notification.updateMany({
    where: {
      userEmail,
      read: false,
    },
    data: {
      read: true,
    },
  });
}

// Delete a single notification
export async function deleteNotification(
  notificationId: string,
  userEmail: string
) {
  // First verify the notification exists and belongs to the user
  const existingNotification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userEmail,
    },
  });

  if (!existingNotification) {
    throw new Error(
      "Notification not found or you don't have permission to delete it"
    );
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

// Batch delete multiple notifications for a user
export async function batchDeleteNotifications(
  notificationIds: string[],
  userEmail: string
) {
  if (notificationIds.length === 0) {
    throw new Error("No notification IDs provided");
  }

  // First verify all notifications exist and belong to the user
  const existingNotifications = await prisma.notification.findMany({
    where: {
      id: { in: notificationIds },
      userEmail,
    },
  });

  if (existingNotifications.length !== notificationIds.length) {
    throw new Error(
      "Some notifications not found or you don't have permission to delete them"
    );
  }

  // Delete all notifications
  const deleteResult = await prisma.notification.deleteMany({
    where: {
      id: { in: notificationIds },
      userEmail, // Double-check user ownership
    },
  });

  return {
    success: true,
    deletedCount: deleteResult.count,
    deletedNotifications: existingNotifications,
  };
}

// Delete all read notifications for a user
export async function deleteAllReadNotifications(userEmail: string) {
  // Get all read notifications first
  const readNotifications = await prisma.notification.findMany({
    where: {
      userEmail,
      read: true,
    },
  });

  // Delete all read notifications
  const deleteResult = await prisma.notification.deleteMany({
    where: {
      userEmail,
      read: true,
    },
  });

  return {
    success: true,
    deletedCount: deleteResult.count,
    deletedNotifications: readNotifications,
  };
}

// Delete all notifications for a user (cleanup function)
export async function deleteAllNotificationsForUser(userEmail: string) {
  // Get all notifications first
  const allNotifications = await prisma.notification.findMany({
    where: {
      userEmail,
    },
  });

  // Delete all notifications
  const deleteResult = await prisma.notification.deleteMany({
    where: {
      userEmail,
    },
  });

  return {
    success: true,
    deletedCount: deleteResult.count,
    deletedNotifications: allNotifications,
  };
}

// Generate transcription and embedding notifications based on results
export async function createTranscriptionNotifications({
  userEmail,
  transcriptionSuccesses,
  transcriptionFailures,
  embeddingSuccesses,
  embeddingFailures,
}: {
  userEmail: string;
  transcriptionSuccesses: Video[];
  transcriptionFailures: Video[];
  embeddingSuccesses: Video[];
  embeddingFailures: Video[];
}) {
  const notificationsToCreate = [];

  // Transcription success notifications
  if (transcriptionSuccesses.length > 0) {
    const videoTitles = transcriptionSuccesses
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3); // Show first 3 titles

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
      userEmail,
      type: NotificationType.TRANSCRIPTION_SUCCESS,
      message,
    });
  }

  // Transcription failure notifications
  if (transcriptionFailures.length > 0) {
    const videoTitles = transcriptionFailures
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3); // Show first 3 titles

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
      userEmail,
      type: NotificationType.TRANSCRIPTION_ERROR,
      message,
    });
  }

  // Embedding success notifications
  if (embeddingSuccesses.length > 0) {
    const videoTitles = embeddingSuccesses
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3); // Show first 3 titles

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
      userEmail,
      type: NotificationType.EMBEDDING_SUCCESS,
      message,
    });
  }

  // Embedding failure notifications
  if (embeddingFailures.length > 0) {
    const videoTitles = embeddingFailures
      .map((v) => v.title || v.youtubeId)
      .slice(0, 3); // Show first 3 titles

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
      userEmail,
      type: NotificationType.EMBEDDING_ERROR,
      message,
    });
  }

  // Create all notifications at once
  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate,
    });

    console.log(
      `📬 Created ${notificationsToCreate.length} notification(s) for user ${userEmail}`
    );
  }

  return {
    created: notificationsToCreate.length,
    notifications: notificationsToCreate,
  };
}
