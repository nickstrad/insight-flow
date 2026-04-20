import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { prisma } from "@/db";
import { inngest } from "@/inngest/client";

export const transcriptRouter = createTRPCRouter({
  transcribeVideos: baseProcedure
    .input(
      z.object({
        youtubeVideos: z
          .array(
            z.object({
              youtubeId: z
                .string()
                .min(1, { message: "YouTube ID is required." }),
              title: z.string().min(1, { message: "Title is required." }),
              description: z.string().optional(),
              thumbnail: z.string().optional(),
              channelHandle: z.string(),
              playlistId: z.string().optional(),
              playlistTitle: z.string().optional(),
              thumbnailUrl: z.string().optional(),
            })
          )
          .min(1, { message: "At least one video is required." }),
        batchSize: z
          .number()
          .min(1, { message: "Batch size must be at least 1." })
          .default(5),
      })
    )
    .mutation(async ({ input: { youtubeVideos, batchSize } }) => {
      await inngest.send({
        name: "transcription/videos.submitted",
        data: {
          youtubeVideos,
          batchSize,
        },
      });

      return {
        success: true,
        message: `Transcription started for ${youtubeVideos.length} video${youtubeVideos.length > 1 ? "s" : ""}. You'll receive notifications when complete.`,
        videoCount: youtubeVideos.length,
        async: true,
      };
    }),

  transcribeExistingVideos: baseProcedure
    .input(
      z.object({
        videoIds: z
          .array(z.string().min(1, { message: "Video ID is required." }))
          .min(1, { message: "At least one video ID is required." }),
        batchSize: z
          .number()
          .min(1, { message: "Batch size must be at least 1." })
          .default(5),
      })
    )
    .mutation(async ({ input: { videoIds, batchSize } }) => {
      const videos = await prisma.video.findMany({
        where: {
          id: { in: videoIds },
        },
      });

      if (videos.length === 0) {
        throw new Error("No videos found with the provided IDs");
      }

      await inngest.send({
        name: "transcription/existing-videos.submitted",
        data: {
          videos,
          batchSize,
        },
      });

      return {
        success: true,
        message: `Re-transcription started for ${videos.length} video${videos.length > 1 ? "s" : ""}. You'll receive notifications when complete.`,
        videoCount: videos.length,
        async: true,
      };
    }),

  retryVideo: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
      })
    )
    .mutation(async ({ input: { videoId } }) => {
      await inngest.send({
        name: "transcription/retry.requested",
        data: {
          videoId,
        },
      });

      return {
        success: true,
        message:
          "Video retry started. You'll receive notifications when complete.",
        async: true,
      };
    }),

  transcribeVideosOnly: baseProcedure
    .input(
      z.object({
        youtubeVideos: z
          .array(
            z.object({
              youtubeId: z
                .string()
                .min(1, { message: "YouTube ID is required." }),
              title: z.string().min(1, { message: "Title is required." }),
              description: z.string().optional(),
              thumbnail: z.string().optional(),
              channelHandle: z.string(),
              playlistId: z.string().optional(),
              playlistTitle: z.string().optional(),
              thumbnailUrl: z.string().optional(),
            })
          )
          .min(1, { message: "At least one video is required." }),
        batchSize: z
          .number()
          .min(1, { message: "Batch size must be at least 1." })
          .default(5),
      })
    )
    .mutation(async ({ input: { youtubeVideos, batchSize } }) => {
      await inngest.send({
        name: "transcription/videos-only.submitted",
        data: {
          youtubeVideos,
          batchSize,
        },
      });

      return {
        success: true,
        message: `Transcription-only started for ${youtubeVideos.length} video${youtubeVideos.length > 1 ? "s" : ""} (no embeddings). You'll receive notifications when complete.`,
        videoCount: youtubeVideos.length,
        async: true,
      };
    }),
});
