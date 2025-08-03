import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { transcribeVideos } from ".";

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
});
