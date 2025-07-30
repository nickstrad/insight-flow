import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { getVideos, syncVideos } from ".";

export const channelRouter = createTRPCRouter({
  getAll: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { channelHandle } }) => {
      const vidoes = await getVideos(channelHandle);
      return vidoes;
    }),
  syncVideos: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .mutation(async ({ input: { channelHandle } }) => {
      await syncVideos(channelHandle);
    }),
});
