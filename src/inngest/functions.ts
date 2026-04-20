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

export const transcribeVideosHandler = inngest.createFunction(
  {
    id: "transcribe-videos-handler",
    retries: 3,
  },
  { event: "transcription/videos.submitted" },
  async ({ event, step }) => {
    const { youtubeVideos, batchSize = 5 } = event.data as {
      youtubeVideos: YoutubeVideo[];
      batchSize?: number;
    };

    console.log(
      `Inngest: Starting transcription of ${youtubeVideos.length} videos`
    );

    await step.run("send-start-notification", async () => {
      await inngest.send({
        name: "transcription/notification.started",
        data: {
          videoCount: youtubeVideos.length,
          type: "full-transcription",
        },
      });
    });

    const result = await step.run("execute-transcription", async () => {
      return await transcribeVideos({
        youtubeVideos,
        batchSize,
      });
    });

    console.log(
      `Inngest: Transcription complete - ${result.totalTranscribed}/${result.totalAttempts} videos processed`
    );

    return result;
  }
);

export const transcribeExistingVideosHandler = inngest.createFunction(
  {
    id: "transcribe-existing-videos-handler",
    retries: 3,
  },
  { event: "transcription/existing-videos.submitted" },
  async ({ event, step }) => {
    const { videos, batchSize = 5 } = event.data as {
      videos: Video[];
      batchSize?: number;
    };

    console.log(
      `Inngest: Starting re-transcription of ${videos.length} existing videos`
    );

    await step.run("send-start-notification", async () => {
      await inngest.send({
        name: "transcription/notification.started",
        data: {
          videoCount: videos.length,
          type: "re-transcription",
        },
      });
    });

    const result = await step.run("execute-re-transcription", async () => {
      return await transcribeExistingVideo({
        videos,
        batchSize,
      });
    });

    console.log(
      `Inngest: Re-transcription complete - ${result.totalTranscribed}/${result.totalAttempts} videos processed`
    );

    return result;
  }
);

export const transcribeVideosOnlyHandler = inngest.createFunction(
  {
    id: "transcribe-videos-only-handler",
    retries: 3,
  },
  { event: "transcription/videos-only.submitted" },
  async ({ event, step }) => {
    const { youtubeVideos, batchSize = 5 } = event.data as {
      youtubeVideos: YoutubeVideo[];
      batchSize?: number;
    };

    console.log(
      `Inngest: Starting transcription-only of ${youtubeVideos.length} videos`
    );

    await step.run("send-start-notification", async () => {
      await inngest.send({
        name: "transcription/notification.started",
        data: {
          videoCount: youtubeVideos.length,
          type: "transcription-only",
        },
      });
    });

    const result = await step.run("execute-transcription-only", async () => {
      return await transcribeVideosOnly({
        youtubeVideos,
        batchSize,
      });
    });

    console.log(
      `Inngest: Transcription-only complete - ${result.totalTranscribed}/${result.totalAttempts} videos processed`
    );

    return result;
  }
);

export const retryVideoHandler = inngest.createFunction(
  {
    id: "retry-video-handler",
    retries: 3,
  },
  { event: "transcription/retry.requested" },
  async ({ event, step }) => {
    const { videoId } = event.data as {
      videoId: string;
    };

    console.log(`Inngest: Retrying video ${videoId}`);

    const result = await step.run("execute-retry", async () => {
      return await retryVideo({
        videoId,
      });
    });

    console.log(
      `Inngest: Retry ${result.success ? "successful" : "failed"} for video ${videoId}`
    );

    return result;
  }
);

export const startTranscriptionNotification = inngest.createFunction(
  { id: "start-transcription-notification" },
  { event: "transcription/notification.started" },
  async ({ event, step }) => {
    const { videoCount, type } = event.data as {
      videoCount: number;
      type: "full-transcription" | "re-transcription" | "transcription-only";
    };

    const messageMap = {
      "full-transcription": `Started transcribing ${videoCount} video${videoCount > 1 ? "s" : ""}. This may take a while - you'll be notified when complete.`,
      "re-transcription": `Started re-transcribing ${videoCount} video${videoCount > 1 ? "s" : ""}. This may take a while - you'll be notified when complete.`,
      "transcription-only": `Started transcribing ${videoCount} video${videoCount > 1 ? "s" : ""} (transcription only). This may take a while - you'll be notified when complete.`,
    };

    const message = messageMap[type];

    await step.run("create-notification", async () => {
      await createNotification({
        type: NotificationType.TRANSCRIPTION_STARTED,
        message,
      });
    });

    return { success: true, message };
  }
);
