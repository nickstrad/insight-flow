import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { getVideos } from ".";

export const channelRouter = createTRPCRouter({
  getAll: baseProcedure
    .input(
      z.object({
        userEmail: z.string().min(1, { message: "User email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      const videos = await getVideos(userEmail);
      return videos;
    }),
  // syncVideos: baseProcedure
  //   .input(
  //     z.object({
  //       channelHandle: z
  //         .string()
  //         .min(1, { message: "Channel handle is required." }),
  //     })
  //   )
  //   .mutation(async ({ input: { channelHandle } }) => {
  //     await syncVideos(channelHandle);
  //   }),
});
