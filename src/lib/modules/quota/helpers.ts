import { prisma } from "@/db";
import { Video } from "@/generated/prisma";
import { YoutubeVideo } from "../videos/types";
import axios from "axios";
import { convertDurationToMinutes } from "@/lib/utils";

// YouTube API utilities (copied from channels module)
interface YouTubeVideoDetailsResponse {
  items: {
    id: string;
    contentDetails: {
      duration: string; // ISO 8601 duration format (e.g., "PT4M13S")
    };
  }[];
}

export const DEFAULT_MESSAGES_QUOTA = {
  BASIC: 100,
  PRO: 1000,
} as const;

export const DEFAULT_VIDEO_HOURS_QUOTA = {
  BASIC: 10,
  PRO: 100,
} as const;

export const getNextResetDate = () => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
};

export const getValidResetDate = (currentResetAt: Date) => {
  const now = new Date();
  let resetDate = new Date(currentResetAt);

  // Keep incrementing by month until we get a date in the future
  while (resetDate <= now) {
    resetDate = new Date(resetDate.getFullYear(), resetDate.getMonth() + 1, 1);
  }

  return resetDate;
};

export const upsertQuota = async ({
  userEmail,
  messagesLeft,
  videoHoursLeft,
  resetAt,
}: {
  userEmail: string;
  messagesLeft?: number;
  videoHoursLeft?: number;
  resetAt?: Date;
}) => {
  return prisma.quota.upsert({
    where: { userEmail },
    update: { messagesLeft, videoHoursLeft, resetAt },
    create: {
      userEmail,
      messagesLeft: messagesLeft || DEFAULT_MESSAGES_QUOTA.BASIC,
      videoHoursLeft: videoHoursLeft || DEFAULT_VIDEO_HOURS_QUOTA.BASIC,
      resetAt: resetAt || getNextResetDate(),
    },
  });
};

export const resetMessages = async (userEmail: string) => {
  return prisma.quota.update({
    where: { userEmail },
    data: {
      messagesLeft: DEFAULT_MESSAGES_QUOTA.BASIC,
      resetAt: getNextResetDate(),
    },
  });
};

export const getQuota = async (userEmail: string) => {
  let quota = await prisma.quota.findFirst({
    where: {
      userEmail,
    },
  });

  if (!quota) {
    quota = await prisma.quota.create({
      data: {
        userEmail,
        messagesLeft: DEFAULT_MESSAGES_QUOTA.BASIC,
        videoHoursLeft: DEFAULT_VIDEO_HOURS_QUOTA.BASIC,
        resetAt: getNextResetDate(),
      },
    });
  } else {
    // Check if resetAt date is outdated
    const now = new Date();
    if (quota.resetAt <= now) {
      // Reset quota to default basic values and update resetAt
      quota = await prisma.quota.update({
        where: { userEmail },
        data: {
          messagesLeft: DEFAULT_MESSAGES_QUOTA.BASIC,
          resetAt: getValidResetDate(quota.resetAt),
        },
      });
    }
  }

  return quota;
};

// Fetch video durations for a batch of video IDs
export async function fetchVideoDurations(
  videoIds: string[]
): Promise<Map<string, number>> {
  const durationMap = new Map<string, number>();
  const API_KEY = process.env.GOOGLE_API_KEY!;

  if (videoIds.length === 0) return durationMap;

  // Process in batches of 50 (YouTube API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);

    try {
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

      data.items.forEach((item) => {
        const duration = convertDurationToMinutes(item.contentDetails.duration);
        durationMap.set(item.id, duration);
      });
    } catch (error) {
      console.error(
        `Error fetching durations for batch: ${batch.join(",")}`,
        error
      );
      // Continue with next batch even if one fails
    }
  }

  return durationMap;
}

// Create Video records from YoutubeVideo data with durations
export async function createVideoRecordsFromYoutubeVideos(
  youtubeVideos: YoutubeVideo[],
  userEmail: string,
  durationMap: Map<string, number>
): Promise<Video[]> {
  const videoRecords: Video[] = [];

  console.log(youtubeVideos);
  for (const ytVideo of youtubeVideos) {
    const duration = durationMap.get(ytVideo.youtubeId) || 0;

    // Check if video already exists
    const existingVideo = await prisma.video.findUnique({
      where: { youtubeId: ytVideo.youtubeId },
    });

    if (existingVideo) {
      videoRecords.push(existingVideo);
      continue;
    }

    // Create new video record
    const videoRecord = await prisma.video.create({
      data: {
        youtubeId: ytVideo.youtubeId,
        userEmail,
        title: ytVideo.title,
        content: "", // Will be filled after transcription
        channelHandle: ytVideo.channelHandle,
        durationInMinutes: duration,
        status: "PENDING",
      },
    });

    videoRecords.push(videoRecord);
  }

  return videoRecords;
}

// Calculate video hours needed for quota (rounds up)
export function calculateVideoHoursNeeded(durationInMinutes: number): number {
  return Math.ceil(durationInMinutes / 60);
}

// Check if user has sufficient quota for video transcription
export async function checkVideoQuota(
  userEmail: string,
  videoHoursNeeded: number
): Promise<{ hasQuota: boolean; currentQuota: any }> {
  const currentQuota = await getQuota(userEmail);
  return {
    hasQuota: currentQuota.videoHoursLeft >= videoHoursNeeded,
    currentQuota,
  };
}

// Deduct video hours from user quota
export async function deductVideoQuota(
  userEmail: string,
  videoHoursUsed: number
): Promise<any> {
  const currentQuota = await getQuota(userEmail);
  const newVideoHoursLeft = Math.max(
    0,
    currentQuota.videoHoursLeft - videoHoursUsed
  );

  return upsertQuota({
    userEmail,
    videoHoursLeft: newVideoHoursLeft,
  });
}
