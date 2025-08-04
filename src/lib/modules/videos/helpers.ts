import axios from "axios";
import { YoutubeVideo } from "./types";
import { prisma } from "@/db";

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

const API_KEY = process.env.GOOGLE_API_KEY!;

// Convert ISO 8601 duration (e.g., "PT4M13S") to minutes rounded up
function convertDurationToMinutes(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  const totalMinutes = hours * 60 + minutes + seconds / 60;
  return Math.ceil(totalMinutes);
}

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
}: {
  channelHandle: string;
  playlistId: string;
  nextToken?: string;
  currentPage: number;
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
