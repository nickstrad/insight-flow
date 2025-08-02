import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { getVideosForChannel } from "./videoHelpers";

export const videosRouter = createTRPCRouter({
  getVideosForChannel: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { channelHandle } }) => {
      return getVideosForChannel(channelHandle);
    }),
  
  getStoredVideosForChannel: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { channelHandle } }) => {
      const { prisma } = await import("@/db");
      return await prisma.video.findMany({
        where: {
          userEmail: channelHandle, // Assuming channelHandle maps to userEmail
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }),
});
