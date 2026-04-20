import axios from "axios";
import { YoutubeVideo } from "./types";
import { convertDurationToMinutes } from "../../utils";

interface YouTubeChannelResponse {
  items: {
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }[];
}

interface YouTubePlaylistDetailsResponse {
  items: {
    contentDetails: {
      itemCount: number;
    };
    snippet?: {
      title: string;
      description: string;
      thumbnails: {
        [key: string]: {
          url: string;
        };
      };
    };
  }[];
}

interface YouTubePlaylistItemsResponse {
  nextPageToken?: string;
  items: {
    snippet: {
      resourceId: {
        videoId: string;
      };
      title: string;
      description: string;
      publishedAt: string;
      thumbnails: {
        [key: string]: {
          url: string;
        };
      };
    };
  }[];
}

interface YouTubeVideoDetailsResponse {
  items: {
    contentDetails: {
      duration: string;
    };
  }[];
}

interface YouTubeChannelPlaylistsResponse {
  nextPageToken?: string;
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        [key: string]: {
          url: string;
        };
      };
    };
    contentDetails: {
      itemCount: number;
    };
  }[];
}

const API_KEY = process.env.GOOGLE_API_KEY!;

export async function fetchVideoDurations(
  videoIds: string[]
): Promise<Map<string, number>> {
  const durationMap = new Map<string, number>();

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);

    const { data } = await axios.get<YouTubeVideoDetailsResponse>(
      `https://www.googleapis.com/youtube/v3/videos`,
      {
        params: {
          part: "contentDetails",
          id: batch.join(","),
          key: API_KEY,
        },
      }
    );

    data.items.forEach((item, index) => {
      const videoId = batch[index];
      const duration = convertDurationToMinutes(item.contentDetails.duration);
      durationMap.set(videoId, duration);
    });
  }

  return durationMap;
}

export const PAGINATION_LIMIT = 20;

export async function getUploadsMetadataForChannel(
  channelHandle: string
): Promise<{
  uploadsPlaylistId: string;
  firstPageVideos: YoutubeVideo[];
  nextToken?: string;
  totalVideoCount: number;
}> {
  try {
    const { data: channelRes } = await axios.get<YouTubeChannelResponse>(
      `https://www.googleapis.com/youtube/v3/channels`,
      {
        params: {
          part: "contentDetails",
          forHandle: channelHandle,
          key: API_KEY,
        },
      }
    );

    const uploadsPlaylistId =
      channelRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error("Failed to retrieve uploads playlist ID.");
    }

    const { data: playlistDetailsRes } =
      await axios.get<YouTubePlaylistDetailsResponse>(
        `https://www.googleapis.com/youtube/v3/playlists`,
        {
          params: {
            part: "contentDetails",
            id: uploadsPlaylistId,
            key: API_KEY,
          },
        }
      );

    const totalVideoCount =
      playlistDetailsRes.items?.[0]?.contentDetails?.itemCount || 0;

    const { data: playlistRes } = await axios.get<YouTubePlaylistItemsResponse>(
      `https://www.googleapis.com/youtube/v3/playlistItems`,
      {
        params: {
          part: "snippet",
          maxResults: PAGINATION_LIMIT,
          playlistId: uploadsPlaylistId,
          key: API_KEY,
        },
      }
    );

    const videos = playlistRes.items.map((item) => {
      const video: YoutubeVideo = {
        youtubeId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.default.url,
        channelHandle,
        playlistId: uploadsPlaylistId,
        playlistTitle: "Uploads",
        thumbnailUrl: item.snippet.thumbnails.default.url,
      };
      return video;
    });

    const videoIds = videos.map((video) => video.youtubeId);
    const durationMap = await fetchVideoDurations(videoIds);

    const videosWithDuration = videos.map((video) => ({
      ...video,
      durationInMinutes: durationMap.get(video.youtubeId) || 0,
    }));

    return {
      uploadsPlaylistId,
      firstPageVideos: videosWithDuration,
      nextToken: playlistRes.nextPageToken,
      totalVideoCount,
    };
  } catch (error) {
    console.error("Error fetching videos from channel:", error);
    throw error;
  }
}

export async function getNextVideosForPlaylist({
  channelHandle,
  playlistId,
  nextToken,
  currentPage,
  playlistTitle,
}: {
  channelHandle: string;
  playlistId: string;
  nextToken?: string;
  currentPage: number;
  playlistTitle?: string;
}): Promise<{
  videos: YoutubeVideo[];
  nextToken?: string;
  forPage: number;
}> {
  try {
    const { data: playlistRes } = await axios.get<YouTubePlaylistItemsResponse>(
      `https://www.googleapis.com/youtube/v3/playlistItems`,
      {
        params: {
          part: "snippet",
          maxResults: PAGINATION_LIMIT,
          playlistId: playlistId,
          pageToken: nextToken,
          key: API_KEY,
        },
      }
    );

    const videos = playlistRes.items.map((item) => {
      const video: YoutubeVideo = {
        youtubeId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.default.url,
        channelHandle,
        playlistId: playlistId,
        playlistTitle: playlistTitle,
        thumbnailUrl: item.snippet.thumbnails.default.url,
      };
      return video;
    });

    const videoIds = videos.map((video) => video.youtubeId);
    const durationMap = await fetchVideoDurations(videoIds);

    const videosWithDuration = videos.map((video) => ({
      ...video,
      durationInMinutes: durationMap.get(video.youtubeId) || 0,
    }));

    return {
      videos: videosWithDuration,
      nextToken: playlistRes.nextPageToken,
      forPage: currentPage,
    };
  } catch (error) {
    console.error("Error fetching videos from channel:", error);
    throw error;
  }
}

export async function getPlaylistMetadata(
  playlistId: string,
  channelHandle: string
): Promise<{
  playlistId: string;
  firstPageVideos: YoutubeVideo[];
  nextToken?: string;
  totalVideoCount: number;
  channelHandle: string;
}> {
  try {
    const { data: playlistDetailsRes } =
      await axios.get<YouTubePlaylistDetailsResponse>(
        `https://www.googleapis.com/youtube/v3/playlists`,
        {
          params: {
            part: "contentDetails,snippet",
            id: playlistId,
            key: API_KEY,
          },
        }
      );

    const playlistItem = playlistDetailsRes.items?.[0];
    if (!playlistItem) {
      throw new Error("Playlist not found");
    }

    const totalVideoCount = playlistItem.contentDetails?.itemCount || 0;

    const { data: playlistRes } = await axios.get<YouTubePlaylistItemsResponse>(
      `https://www.googleapis.com/youtube/v3/playlistItems`,
      {
        params: {
          part: "snippet",
          maxResults: PAGINATION_LIMIT,
          playlistId: playlistId,
          key: API_KEY,
        },
      }
    );

    const videos = playlistRes.items.map((item) => {
      const video: YoutubeVideo = {
        youtubeId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.default.url,
        channelHandle: channelHandle,
        playlistId: playlistId,
        playlistTitle: playlistItem.snippet?.title,
        thumbnailUrl: item.snippet.thumbnails.default.url,
      };
      return video;
    });

    const videoIds = videos.map((video) => video.youtubeId);
    const durationMap = await fetchVideoDurations(videoIds);

    const videosWithDuration = videos.map((video) => ({
      ...video,
      durationInMinutes: durationMap.get(video.youtubeId) || 0,
    }));

    return {
      playlistId,
      firstPageVideos: videosWithDuration,
      nextToken: playlistRes.nextPageToken,
      totalVideoCount,
      channelHandle,
    };
  } catch (error) {
    console.error("Error fetching playlist metadata:", error);
    throw error;
  }
}

export async function getChannelPlaylists(channelHandle: string): Promise<
  Array<{
    id: string;
    title: string;
    description: string;
    itemCount: number;
    thumbnail?: string;
  }>
> {
  try {
    const { data: channelRes } = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels`,
      {
        params: {
          part: "id",
          forHandle: channelHandle,
          key: API_KEY,
        },
      }
    );

    const channelId = channelRes.items?.[0]?.id;
    if (!channelId) {
      throw new Error("Failed to retrieve channel ID.");
    }

    const playlists = [];
    let nextPageToken = "";

    do {
      const { data: playlistRes } =
        await axios.get<YouTubeChannelPlaylistsResponse>(
          `https://www.googleapis.com/youtube/v3/playlists`,
          {
            params: {
              part: "snippet,contentDetails",
              channelId: channelId,
              maxResults: 50,
              pageToken: nextPageToken,
              key: API_KEY,
            },
          }
        );

      const playlistItems = playlistRes.items.map((item) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        itemCount: item.contentDetails.itemCount,
        thumbnail: item.snippet.thumbnails.default?.url,
      }));

      playlists.push(...playlistItems);
      nextPageToken = playlistRes.nextPageToken || "";
    } while (nextPageToken);

    const { data: channelDetailsRes } = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels`,
      {
        params: {
          part: "contentDetails,snippet",
          id: channelId,
          key: API_KEY,
        },
      }
    );

    const uploadsPlaylistId =
      channelDetailsRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploadsPlaylistId) {
      const { data: uploadsPlaylistRes } = await axios.get(
        `https://www.googleapis.com/youtube/v3/playlists`,
        {
          params: {
            part: "contentDetails,snippet",
            id: uploadsPlaylistId,
            key: API_KEY,
          },
        }
      );

      if (uploadsPlaylistRes.items?.[0]) {
        const uploadsPlaylist = uploadsPlaylistRes.items[0];
        playlists.unshift({
          id: uploadsPlaylistId,
          title: "Uploads",
          description: "All uploaded videos",
          itemCount: uploadsPlaylist.contentDetails.itemCount,
          thumbnail: uploadsPlaylist.snippet?.thumbnails?.default?.url,
        });
      }
    }

    return playlists;
  } catch (error) {
    console.error("Error fetching channel playlists:", error);
    throw error;
  }
}

export async function getAllPlaylistsForUser(): Promise<
  Array<{ playlistId: string; count: number }>
> {
  const { prisma } = await import("@/db");

  const playlistsWithCount = await prisma.video.groupBy({
    by: ["playlistId"],
    where: {
      playlistId: {
        not: null,
      },
    },
    _count: {
      playlistId: true,
    },
  });

  return playlistsWithCount
    .filter((item) => item.playlistId !== null)
    .map((item) => ({
      playlistId: item.playlistId!,
      count: item._count.playlistId,
    }));
}

export async function getStoredVideoById(videoId: string) {
  const { prisma } = await import("@/db");

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    throw new Error("Video not found");
  }
  return video;
}

export async function updateStoredVideo(
  videoId: string,
  updateData: {
    title?: string;
    channelHandle?: string;
    playlistId?: string;
  }
) {
  const { prisma } = await import("@/db");

  return prisma.video.update({
    where: { id: videoId },
    data: { ...updateData, updatedAt: new Date() },
  });
}

export async function deleteStoredVideo(videoId: string) {
  const { prisma } = await import("@/db");

  await prisma.video.delete({ where: { id: videoId } });
  return { success: true };
}

export async function bulkDeleteStoredVideos(videoIds: string[]) {
  const { prisma } = await import("@/db");

  if (videoIds.length === 0) {
    throw new Error("No video IDs provided");
  }

  const { count } = await prisma.video.deleteMany({
    where: { id: { in: videoIds } },
  });

  return { success: true, deletedCount: count };
}

export async function getUserChannelsAndPlaylists(): Promise<
  Array<{
    channelHandle: string;
    playlists: Array<{
      playlistId: string;
      playlistTitle: string | null;
      videoCount: number;
    }>;
  }>
> {
  const { prisma } = await import("@/db");

  const channelPlaylistData = await prisma.video.groupBy({
    by: ["channelHandle", "playlistId", "playlistTitle"],
    where: {
      channelHandle: {
        not: null,
      },
      playlistId: {
        not: null,
      },
    },
    _count: {
      id: true,
    },
  });

  const channelMap = new Map<
    string,
    Array<{
      playlistId: string;
      playlistTitle: string | null;
      videoCount: number;
    }>
  >();

  channelPlaylistData.forEach((item) => {
    if (item.channelHandle && item.playlistId) {
      if (!channelMap.has(item.channelHandle)) {
        channelMap.set(item.channelHandle, []);
      }

      channelMap.get(item.channelHandle)!.push({
        playlistId: item.playlistId,
        playlistTitle: item.playlistTitle,
        videoCount: item._count.id,
      });
    }
  });

  return Array.from(channelMap.entries()).map(([channelHandle, playlists]) => ({
    channelHandle,
    playlists,
  }));
}
