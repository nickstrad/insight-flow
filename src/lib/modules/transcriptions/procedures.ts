import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  transcribeVideos,
  transcribeExistingVideo,
  transcribeVideosOnly,
  retryVideo,
} from "./helpers";
import { prisma } from "@/db";

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
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
        batchSize: z
          .number()
          .min(1, { message: "Batch size must be at least 1." })
          .default(5),
      })
    )
    .mutation(async ({ input: { youtubeVideos, userEmail, batchSize } }) => {
      return transcribeVideos({
        youtubeVideos,
        userEmail,
        batchSize,
      });
    }),

  transcribeExistingVideos: baseProcedure
    .input(
      z.object({
        videoIds: z
          .array(z.string().min(1, { message: "Video ID is required." }))
          .min(1, { message: "At least one video ID is required." }),
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
        batchSize: z
          .number()
          .min(1, { message: "Batch size must be at least 1." })
          .default(5),
      })
    )
    .mutation(async ({ input: { videoIds, userEmail, batchSize } }) => {
      // Fetch the Video records from the database
      const videos = await prisma.video.findMany({
        where: {
          id: { in: videoIds },
          userEmail: userEmail,
        },
      });

      if (videos.length === 0) {
        throw new Error("No videos found with the provided IDs");
      }

      return transcribeExistingVideo({
        videos,
        userEmail,
        batchSize,
      });
    }),

  retryVideo: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { videoId, userEmail } }) => {
      return retryVideo({
        videoId,
        userEmail,
      });
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
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
        batchSize: z
          .number()
          .min(1, { message: "Batch size must be at least 1." })
          .default(5),
      })
    )
    .mutation(async ({ input: { youtubeVideos, userEmail, batchSize } }) => {
      return transcribeVideosOnly({
        youtubeVideos,
        userEmail,
        batchSize,
      });
    }),
});
