import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  getUploadsMetadataForChannel,
  getNextVideosForPlaylist,
  getPlaylistMetadata,
  getAllPlaylistsForUser,
  getChannelPlaylists,
  getStoredVideoById,
  updateStoredVideo,
  deleteStoredVideo,
  bulkDeleteStoredVideos,
  getUserChannelsAndPlaylists,
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
        playlistTitle: z.string().optional(),
      })
    )
    .query(
      async ({
        input: {
          channelHandle,
          playlistId,
          nextToken,
          currentPage,
          playlistTitle,
        },
      }) => {
        return getNextVideosForPlaylist({
          channelHandle,
          playlistId,
          nextToken,
          currentPage,
          playlistTitle,
        });
      }
    ),
  getStoredVideosForChannel: baseProcedure.query(async () => {
    return await prisma.video.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }),
  getAllChannelsForUser: baseProcedure.query(async () => {
    const vals = await prisma.video.findMany({
      select: {
        channelHandle: true,
      },
      distinct: ["channelHandle"],
    });

    return vals.filter(Boolean).map((v) => v.channelHandle!);
  }),
  getPlaylistMetadata: baseProcedure
    .input(
      z.object({
        playlistId: z.string().min(1, { message: "Playlist ID is required." }),
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { playlistId, channelHandle } }) => {
      return getPlaylistMetadata(playlistId, channelHandle);
    }),
  getAllPlaylistsForUser: baseProcedure.query(async () => {
    return getAllPlaylistsForUser();
  }),
  getChannelPlaylists: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { channelHandle } }) => {
      return getChannelPlaylists(channelHandle);
    }),

  getStoredVideoById: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
      })
    )
    .query(async ({ input: { videoId } }) => {
      return getStoredVideoById(videoId);
    }),

  updateStoredVideo: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
        updateData: z
          .object({
            title: z.string().optional(),
            channelHandle: z.string().optional(),
            playlistId: z.string().optional(),
          })
          .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field must be provided for update.",
          }),
      })
    )
    .mutation(async ({ input: { videoId, updateData } }) => {
      return updateStoredVideo(videoId, updateData);
    }),

  deleteStoredVideo: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
      })
    )
    .mutation(async ({ input: { videoId } }) => {
      return deleteStoredVideo(videoId);
    }),

  bulkDeleteStoredVideos: baseProcedure
    .input(
      z.object({
        videoIds: z
          .array(z.string().min(1, { message: "Video ID is required." }))
          .min(1, { message: "At least one video ID is required." }),
      })
    )
    .mutation(async ({ input: { videoIds } }) => {
      return bulkDeleteStoredVideos(videoIds);
    }),

  getUserChannelsAndPlaylists: baseProcedure.query(async () => {
    return getUserChannelsAndPlaylists();
  }),
});
