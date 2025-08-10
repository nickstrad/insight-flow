import { inngest } from "./client";
import {
  transcribeVideos,
  transcribeExistingVideo,
  transcribeVideosOnly,
  retryVideo,
} from "@/lib/modules/transcriptions/helpers";
import { createNotification } from "@/lib/modules/notifications/helpers";
import { NotificationType, Video } from "@/generated/prisma";
import { YoutubeVideo } from "@/lib/modules/videos/types";

// Full transcription pipeline (transcription + embeddings)
export const transcribeVideosHandler = inngest.createFunction(
  { 
    id: "transcribe-videos-handler",
    retries: 3,
  },
  { event: "transcription/videos.submitted" },
  async ({ event, step }) => {
    const { youtubeVideos, userEmail, batchSize = 5 } = event.data as {
      youtubeVideos: YoutubeVideo[];
      userEmail: string;
      batchSize?: number;
    };

    console.log(`🎯 Inngest: Starting transcription of ${youtubeVideos.length} videos for user: ${userEmail}`);

    // Step 1: Send start notification
    await step.run("send-start-notification", async () => {
      await inngest.send({
        name: "transcription/notification.started",
        data: {
          userEmail,
          videoCount: youtubeVideos.length,
          type: "full-transcription",
        },
      });
    });

    // Step 2: Execute transcription pipeline
    const result = await step.run("execute-transcription", async () => {
      return await transcribeVideos({
        youtubeVideos,
        userEmail,
        batchSize,
      });
    });

    console.log(`🏁 Inngest: Transcription complete - ${result.totalTranscribed}/${result.totalAttempts} videos processed`);
    
    return result;
  }
);

// Re-transcription of existing videos
export const transcribeExistingVideosHandler = inngest.createFunction(
  { 
    id: "transcribe-existing-videos-handler",
    retries: 3,
  },
  { event: "transcription/existing-videos.submitted" },
  async ({ event, step }) => {
    const { videos, userEmail, batchSize = 5 } = event.data as {
      videos: Video[];
      userEmail: string;
      batchSize?: number;
    };

    console.log(`🔄 Inngest: Starting re-transcription of ${videos.length} existing videos for user: ${userEmail}`);

    // Step 1: Send start notification
    await step.run("send-start-notification", async () => {
      await inngest.send({
        name: "transcription/notification.started",
        data: {
          userEmail,
          videoCount: videos.length,
          type: "re-transcription",
        },
      });
    });

    // Step 2: Execute re-transcription pipeline
    const result = await step.run("execute-re-transcription", async () => {
      return await transcribeExistingVideo({
        videos,
        userEmail,
        batchSize,
      });
    });

    console.log(`🏁 Inngest: Re-transcription complete - ${result.totalTranscribed}/${result.totalAttempts} videos processed`);
    
    return result;
  }
);

// Transcription-only pipeline (no embeddings)
export const transcribeVideosOnlyHandler = inngest.createFunction(
  { 
    id: "transcribe-videos-only-handler",
    retries: 3,
  },
  { event: "transcription/videos-only.submitted" },
  async ({ event, step }) => {
    const { youtubeVideos, userEmail, batchSize = 5 } = event.data as {
      youtubeVideos: YoutubeVideo[];
      userEmail: string;
      batchSize?: number;
    };

    console.log(`📝 Inngest: Starting transcription-only of ${youtubeVideos.length} videos for user: ${userEmail}`);

    // Step 1: Send start notification
    await step.run("send-start-notification", async () => {
      await inngest.send({
        name: "transcription/notification.started",
        data: {
          userEmail,
          videoCount: youtubeVideos.length,
          type: "transcription-only",
        },
      });
    });

    // Step 2: Execute transcription-only pipeline
    const result = await step.run("execute-transcription-only", async () => {
      return await transcribeVideosOnly({
        youtubeVideos,
        userEmail,
        batchSize,
      });
    });

    console.log(`🏁 Inngest: Transcription-only complete - ${result.totalTranscribed}/${result.totalAttempts} videos processed`);
    
    return result;
  }
);

// Single video retry
export const retryVideoHandler = inngest.createFunction(
  { 
    id: "retry-video-handler",
    retries: 3,
  },
  { event: "transcription/retry.requested" },
  async ({ event, step }) => {
    const { videoId, userEmail } = event.data as {
      videoId: string;
      userEmail: string;
    };

    console.log(`🔄 Inngest: Retrying video ${videoId} for user: ${userEmail}`);

    // Execute retry
    const result = await step.run("execute-retry", async () => {
      return await retryVideo({
        videoId,
        userEmail,
      });
    });

    console.log(`🏁 Inngest: Retry ${result.success ? 'successful' : 'failed'} for video ${videoId}`);
    
    return result;
  }
);

// Notification when transcription starts
export const startTranscriptionNotification = inngest.createFunction(
  { id: "start-transcription-notification" },
  { event: "transcription/notification.started" },
  async ({ event, step }) => {
    const { userEmail, videoCount, type } = event.data as {
      userEmail: string;
      videoCount: number;
      type: "full-transcription" | "re-transcription" | "transcription-only";
    };

    // Create notification message based on type
    const messageMap = {
      "full-transcription": `Started transcribing ${videoCount} video${videoCount > 1 ? 's' : ''}. This may take a while - you'll be notified when complete.`,
      "re-transcription": `Started re-transcribing ${videoCount} video${videoCount > 1 ? 's' : ''}. This may take a while - you'll be notified when complete.`,
      "transcription-only": `Started transcribing ${videoCount} video${videoCount > 1 ? 's' : ''} (transcription only). This may take a while - you'll be notified when complete.`,
    };

    const message = messageMap[type];

    await step.run("create-notification", async () => {
      await createNotification({
        userEmail,
        type: NotificationType.TRANSCRIPTION_STARTED,
        message,
      });
    });

    console.log(`📬 Inngest: Sent start notification to user ${userEmail}`);
    
    return { success: true, message };
  }
);
