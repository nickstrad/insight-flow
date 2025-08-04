import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  getUploadsMetadataForChannel,
  getNextVideosForPlaylist,
} from "./helpers";
const { prisma } = await import("@/db");

export const videosRouter = createTRPCRouter({
  getUploadsMetadataForChannel: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { channelHandle } }) => {
      return getUploadsMetadataForChannel(channelHandle);
    }),
  getNextVideosForPlaylist: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
        playlistId: z.string().min(1, { message: "Playlist ID is required." }),
        nextToken: z.string().optional(),
        currentPage: z.number(),
      })
    )
    .query(
      async ({
        input: { channelHandle, playlistId, nextToken, currentPage },
      }) => {
        return getNextVideosForPlaylist({
          channelHandle,
          playlistId,
          nextToken,
          currentPage,
        });
      }
    ),
  getStoredVideosForChannel: baseProcedure
    .input(
      z.object({
        userEmail: z.string().min(1, { message: "User email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      return await prisma.video.findMany({
        where: {
          userEmail,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),
  getAllChannelsForUser: baseProcedure
    .input(
      z.object({
        userEmail: z.string().min(1, { message: "User email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      const vals = await prisma.video.findMany({
        where: {
          userEmail,
        },
        select: {
          channelHandle: true,
        },
        distinct: ["channelHandle"],
      });

      return vals.filter(Boolean).map((v) => v.channelHandle!);
    }),
});
