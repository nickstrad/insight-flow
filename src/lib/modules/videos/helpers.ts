import axios from "axios";
import { YoutubeVideo } from "./types";
import { convertDurationToMinutes } from "../../utils";
import { 
  calculateVideoHoursNeeded, 
  upsertQuota, 
  getQuota 
} from "../quota/helpers";

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
      duration: string; // ISO 8601 duration format (e.g., "PT4M13S")
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

// Fetch video durations for a batch of video IDs
async function fetchVideoDurations(
  videoIds: string[]
): Promise<Map<string, number>> {
  const durationMap = new Map<string, number>();

  // Process in batches of 50 (YouTube API limit)
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

  console.log(durationMap);

  return durationMap;
}

// BACKUP: Original function without duration fetching (for potential revert)
export async function getVideosForChannelOriginal(
  channelHandle: string
): Promise<YoutubeVideo[]> {
  try {
    const videos: YoutubeVideo[] = [];

    // Fetch all videos from the channel's upload playlist
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

    let nextPageToken = "";
    do {
      const { data: playlistRes } =
        await axios.get<YouTubePlaylistItemsResponse>(
          `https://www.googleapis.com/youtube/v3/playlistItems`,
          {
            params: {
              part: "snippet",
              maxResults: 50,
              playlistId: uploadsPlaylistId,
              pageToken: nextPageToken,
              key: API_KEY,
            },
          }
        );

      const nextVideos: YoutubeVideo[] = playlistRes.items.map((item) => {
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

      videos.push(...nextVideos);

      nextPageToken = playlistRes.nextPageToken || "";
    } while (nextPageToken);

    return videos;
  } catch (error) {
    console.error("Error fetching videos from channel:", error);
    throw error;
  }
}

export const PAGINATION_LIMIT = 20;
// Updated function with duration fetching
export async function getUploadsMetadataForChannel(
  channelHandle: string
): Promise<{
  uploadsPlaylistId: string;
  firstPageVideos: YoutubeVideo[];
  nextToken?: string;
  totalVideoCount: number;
}> {
  try {
    // Fetch all videos from the channel's upload playlist
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

    // Get total video count from playlist details
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

    // Get first page of videos
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

    // Fetch duration information for first page videos
    console.log(`Fetching durations for ${videos.length} videos...`);
    const videoIds = videos.map((video) => video.youtubeId);
    const durationMap = await fetchVideoDurations(videoIds);

    // Add duration information to videos
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

    // Fetch duration information for all videos
    console.log(`Fetching durations for ${videos.length} videos...`);
    const videoIds = videos.map((video) => video.youtubeId);
    const durationMap = await fetchVideoDurations(videoIds);

    // Add duration information to videos
    const videosWithDuration = videos.map((video) => ({
      ...video,
      durationInMinutes: durationMap.get(video.youtubeId) || 0,
    }));

    const returnVal = {
      videos: videosWithDuration,
      nextToken: playlistRes.nextPageToken,
      forPage: currentPage,
    };

    console.log(
      `Fetched ${videosWithDuration.length} videos for channel ${channelHandle} with nextToken: ${returnVal.nextToken}`
    );
    return returnVal;
  } catch (error) {
    console.error("Error fetching videos from channel:", error);
    throw error;
  }
}

// New function to get playlist metadata by direct playlist ID
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
    // Get playlist details including title and video count
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

    // Get first page of videos
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
        channelHandle: channelHandle, // Use provided channel handle or fall back to playlist title
        playlistId: playlistId,
        playlistTitle: playlistItem.snippet?.title,
        thumbnailUrl: item.snippet.thumbnails.default.url,
      };
      return video;
    });

    // Fetch duration information for first page videos
    console.log(`Fetching durations for ${videos.length} videos...`);
    const videoIds = videos.map((video) => video.youtubeId);
    const durationMap = await fetchVideoDurations(videoIds);

    // Add duration information to videos
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

// Function to get all playlists for a channel from YouTube API
export async function getChannelPlaylists(
  channelHandle: string
): Promise<Array<{ id: string; title: string; description: string; itemCount: number; thumbnail?: string }>> {
  try {
    // First get the channel ID from the handle
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

    // Get all playlists for the channel
    const playlists = [];
    let nextPageToken = "";
    
    do {
      const { data: playlistRes } = await axios.get<YouTubeChannelPlaylistsResponse>(
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

    // Also get the uploads playlist
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

    const uploadsPlaylistId = channelDetailsRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploadsPlaylistId) {
      // Get uploads playlist details
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
        // Add uploads playlist at the beginning
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

// Function to get all playlists for a user
export async function getAllPlaylistsForUser(
  userEmail: string
): Promise<Array<{ playlistId: string; count: number }>> {
  const { prisma } = await import("@/db");
  
  const playlistsWithCount = await prisma.video.groupBy({
    by: ['playlistId'],
    where: {
      userEmail,
      playlistId: {
        not: null
      }
    },
    _count: {
      playlistId: true
    }
  });

  return playlistsWithCount
    .filter(item => item.playlistId !== null)
    .map(item => ({
      playlistId: item.playlistId!,
      count: item._count.playlistId
    }));
}

// CRUD Functions for stored videos

// Get a single video by ID for a user
export async function getStoredVideoById(
  videoId: string,
  userEmail: string
) {
  const { prisma } = await import("@/db");
  
  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      userEmail,
    },
  });

  if (!video) {
    throw new Error("Video not found or you don't have permission to access it");
  }

  return video;
}

// Update a stored video
export async function updateStoredVideo(
  videoId: string,
  userEmail: string,
  updateData: {
    title?: string;
    channelHandle?: string;
    playlistId?: string;
  }
) {
  const { prisma } = await import("@/db");

  // First verify the video exists and belongs to the user
  const existingVideo = await prisma.video.findFirst({
    where: {
      id: videoId,
      userEmail,
    },
  });

  if (!existingVideo) {
    throw new Error("Video not found or you don't have permission to edit it");
  }

  // Update the video
  const updatedVideo = await prisma.video.update({
    where: {
      id: videoId,
    },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
  });

  return updatedVideo;
}

// Delete a stored video and its associated transcript chunks
export async function deleteStoredVideo(
  videoId: string,
  userEmail: string
) {
  const { prisma } = await import("@/db");

  // First verify the video exists and belongs to the user
  const existingVideo = await prisma.video.findFirst({
    where: {
      id: videoId,
      userEmail,
    },
  });

  if (!existingVideo) {
    throw new Error("Video not found or you don't have permission to delete it");
  }

  // Calculate quota to restore if the video was successfully transcribed
  let quotaToRestore = 0;
  if (existingVideo.status === "COMPLETED") {
    quotaToRestore = calculateVideoHoursNeeded(existingVideo.durationInMinutes);
  }

  // Delete the video (transcript chunks will be deleted due to CASCADE)
  await prisma.video.delete({
    where: {
      id: videoId,
    },
  });

  // Restore quota if applicable
  if (quotaToRestore > 0) {
    const currentQuota = await getQuota(userEmail);
    await upsertQuota({
      userEmail,
      videoHoursLeft: currentQuota.videoHoursLeft + quotaToRestore,
    });
    
    console.log(`Restored ${quotaToRestore} hours to quota for user ${userEmail} after deleting video ${existingVideo.youtubeId}`);
  }

  return { 
    success: true, 
    deletedVideo: existingVideo,
    quotaRestored: quotaToRestore 
  };
}

// Bulk delete multiple videos for a user
export async function bulkDeleteStoredVideos(
  videoIds: string[],
  userEmail: string
) {
  const { prisma } = await import("@/db");

  if (videoIds.length === 0) {
    throw new Error("No video IDs provided");
  }

  // First verify all videos exist and belong to the user
  const existingVideos = await prisma.video.findMany({
    where: {
      id: { in: videoIds },
      userEmail,
    },
  });

  if (existingVideos.length !== videoIds.length) {
    throw new Error("Some videos not found or you don't have permission to delete them");
  }

  // Calculate total quota to restore from completed videos
  let totalQuotaToRestore = 0;
  existingVideos.forEach(video => {
    if (video.status === "COMPLETED") {
      totalQuotaToRestore += calculateVideoHoursNeeded(video.durationInMinutes);
    }
  });

  // Delete all videos (transcript chunks will be deleted due to CASCADE)
  const deleteResult = await prisma.video.deleteMany({
    where: {
      id: { in: videoIds },
      userEmail, // Double-check user ownership
    },
  });

  // Restore quota if applicable
  if (totalQuotaToRestore > 0) {
    const currentQuota = await getQuota(userEmail);
    await upsertQuota({
      userEmail,
      videoHoursLeft: currentQuota.videoHoursLeft + totalQuotaToRestore,
    });
    
    console.log(`Restored ${totalQuotaToRestore} hours to quota for user ${userEmail} after bulk deleting ${deleteResult.count} videos`);
  }

  return { 
    success: true, 
    deletedCount: deleteResult.count,
    deletedVideos: existingVideos,
    quotaRestored: totalQuotaToRestore
  };
}

// Get channels and their playlists from user's saved videos
export async function getUserChannelsAndPlaylists(
  userEmail: string
): Promise<Array<{
  channelHandle: string;
  playlists: Array<{
    playlistId: string;
    playlistTitle: string | null;
    videoCount: number;
  }>;
}>> {
  const { prisma } = await import("@/db");

  // Get all unique channel/playlist combinations for this user
  const channelPlaylistData = await prisma.video.groupBy({
    by: ['channelHandle', 'playlistId', 'playlistTitle'],
    where: {
      userEmail,
      channelHandle: {
        not: null
      },
      playlistId: {
        not: null
      }
    },
    _count: {
      id: true
    }
  });

  // Group by channel handle
  const channelMap = new Map<string, Array<{ playlistId: string; playlistTitle: string | null; videoCount: number }>>();

  channelPlaylistData.forEach(item => {
    if (item.channelHandle && item.playlistId) {
      if (!channelMap.has(item.channelHandle)) {
        channelMap.set(item.channelHandle, []);
      }
      
      channelMap.get(item.channelHandle)!.push({
        playlistId: item.playlistId,
        playlistTitle: item.playlistTitle,
        videoCount: item._count.id
      });
    }
  });

  // Convert map to array format
  return Array.from(channelMap.entries()).map(([channelHandle, playlists]) => ({
    channelHandle,
    playlists
  }));
}
