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
  getPlaylistMetadata: baseProcedure
    .input(
      z.object({
        playlistId: z
          .string()
          .min(1, { message: "Playlist ID is required." }),
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { playlistId, channelHandle } }) => {
      return getPlaylistMetadata(playlistId, channelHandle);
    }),
  getAllPlaylistsForUser: baseProcedure
    .input(
      z.object({
        userEmail: z.string().min(1, { message: "User email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      return getAllPlaylistsForUser(userEmail);
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

  // CRUD Operations for stored videos
  getStoredVideoById: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
        userEmail: z.string().email({ message: "Valid user email is required." }),
      })
    )
    .query(async ({ input: { videoId, userEmail } }) => {
      return getStoredVideoById(videoId, userEmail);
    }),

  updateStoredVideo: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
        userEmail: z.string().email({ message: "Valid user email is required." }),
        updateData: z.object({
          title: z.string().optional(),
          channelHandle: z.string().optional(),
          playlistId: z.string().optional(),
        }).refine(
          (data) => Object.keys(data).length > 0,
          { message: "At least one field must be provided for update." }
        ),
      })
    )
    .mutation(async ({ input: { videoId, userEmail, updateData } }) => {
      return updateStoredVideo(videoId, userEmail, updateData);
    }),

  deleteStoredVideo: baseProcedure
    .input(
      z.object({
        videoId: z.string().min(1, { message: "Video ID is required." }),
        userEmail: z.string().email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { videoId, userEmail } }) => {
      return deleteStoredVideo(videoId, userEmail);
    }),

  bulkDeleteStoredVideos: baseProcedure
    .input(
      z.object({
        videoIds: z
          .array(z.string().min(1, { message: "Video ID is required." }))
          .min(1, { message: "At least one video ID is required." }),
        userEmail: z.string().email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { videoIds, userEmail } }) => {
      return bulkDeleteStoredVideos(videoIds, userEmail);
    }),
});
