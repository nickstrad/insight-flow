import { prisma } from "@/db";
import { Video } from "@/generated/prisma";
import { GoogleGenAI } from "@google/genai";
import { toGeminiSchema } from "gemini-zod";
import z from "zod";
import { YoutubeVideo } from "../videos/types";
import { fetchVideoDurations } from "../videos/helpers";
import {
  appendEmbeddings,
  updateEmbeddingsForExistingChunks,
  type TranscriptChunk,
  type Transcript,
} from "../embeddings/helpers";
import { retryWithBackoff } from "@/lib/utils";
import { createTranscriptionNotifications } from "../notifications/helpers";

type TranscriptWithVideoId = {
  videoId: string;
  chunks: Transcript;
};

type TranscriptionResult = {
  video: Video;
  transcript?: TranscriptWithVideoId;
  fullTranscriptionText?: string;
  error?: string;
};

const zodSchema = z.array(
  z.object({
    timestamp: z.string().describe("The timestamp of this transcription chunk"),
    text: z.string().describe("The transcribed text for this chunk"),
  })
);

import { serverConfig } from "@/lib/config";

const API_KEY = serverConfig.GOOGLE_API_KEY;

const geminiSchema = toGeminiSchema(zodSchema);

function convertTimestampToSeconds(time: string): number | null {
  try {
    const startTime = time.includes(" - ")
      ? time.split(" - ")[0].trim()
      : time.trim();
    const [minutesStr, secondsStr] = startTime.split(":");

    const minutes = parseInt(minutesStr, 10);
    const seconds = parseInt(secondsStr, 10);

    return minutes * 60 + seconds;
  } catch (err) {
    void err;
    return null;
  }
}

function mergeTranscriptChunks(
  transcript: Transcript,
  minChunkDurationSeconds: number = 10
): Transcript {
  if (transcript.length === 0) return transcript;

  const mergedChunks: Transcript = [];
  let currentChunk: TranscriptChunk | null = null;
  let currentChunkStartTime: number = 0;

  for (let i = 0; i < transcript.length; i++) {
    const chunk = transcript[i];
    const chunkTimestamp =
      typeof chunk.timestamp === "number"
        ? chunk.timestamp
        : convertTimestampToSeconds(chunk.timestamp.toString()) || 0;

    if (currentChunk === null) {
      currentChunk = {
        timestamp: chunkTimestamp,
        text: chunk.text,
        embedding: null,
      };
      currentChunkStartTime = chunkTimestamp;
    } else {
      const chunkDuration = chunkTimestamp - currentChunkStartTime;

      if (chunkDuration < minChunkDurationSeconds) {
        currentChunk.text += " " + chunk.text;
      } else {
        mergedChunks.push(currentChunk);
        currentChunk = {
          timestamp: chunkTimestamp,
          text: chunk.text,
          embedding: null,
        };
        currentChunkStartTime = chunkTimestamp;
      }
    }
  }

  if (currentChunk !== null) {
    mergedChunks.push(currentChunk);
  }

  return mergedChunks;
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function createVideoRecordsFromYoutubeVideos(
  youtubeVideos: YoutubeVideo[],
  durationMap: Map<string, number>
): Promise<Video[]> {
  return Promise.all(
    youtubeVideos.map((yv) =>
      prisma.video.upsert({
        where: { youtubeId: yv.youtubeId },
        update: {},
        create: {
          youtubeId: yv.youtubeId,
          title: yv.title,
          content: "",
          channelHandle: yv.channelHandle,
          playlistId: yv.playlistId,
          playlistTitle: yv.playlistTitle,
          thumbnailUrl: yv.thumbnailUrl,
          durationInMinutes: durationMap.get(yv.youtubeId) ?? 0,
        },
      })
    )
  );
}

async function prepareExistingVideos(videos: Video[]): Promise<Video[]> {
  console.log(`Starting re-transcription of ${videos.length} existing videos`);
  const ids = videos.map((v) => v.id);

  await prisma.transcriptChunk.deleteMany({
    where: { videoId: { in: ids } },
  });
  await prisma.video.updateMany({
    where: { id: { in: ids } },
    data: { status: "PENDING", content: "" },
  });

  return prisma.video.findMany({ where: { id: { in: ids } } });
}

async function prepareVideosForEmbedding(videos: Video[]): Promise<Video[]> {
  console.log(`Preparing ${videos.length} videos for embedding`);

  const videosReadyForEmbedding = videos.filter(
    (v) => v.status === "COMPLETED"
  );

  console.log(
    `Found ${videosReadyForEmbedding.length} videos ready for embedding`
  );

  return videosReadyForEmbedding;
}

const getTranscript = async ({
  video,
  fromSeconds,
  toSeconds,
}: {
  video: string;
  fromSeconds: number;
  toSeconds: number;
}) => {
  const operationName = `Transcribe ${video} (${fromSeconds}s-${toSeconds}s)`;

  return await retryWithBackoff(
    async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [
          `Please transcribe this video.`,
          {
            fileData: {
              mimeType: "video/mp4",
              fileUri: `https://www.youtube.com/watch?v=${video}`,
            },
            videoMetadata: {
              startOffset: `${fromSeconds}s`,
              endOffset: `${toSeconds}s`,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: geminiSchema,
        },
      });

      if (!response.text) {
        throw new Error("Empty response from Gemini API");
      }

      const transcriptionArray = JSON.parse(response.text ?? "[]");
      const formattedTranscriptions: Transcript = transcriptionArray.map(
        (item: { timestamp: string; text: string }) => {
          const seconds = convertTimestampToSeconds(item.timestamp);
          const transcription: TranscriptChunk = {
            timestamp: seconds !== null ? seconds : item.timestamp,
            text: item.text,
            embedding: null,
          };
          return transcription;
        }
      );

      const mergedTranscriptions = mergeTranscriptChunks(
        formattedTranscriptions,
        10
      );

      const transcriptionText = mergedTranscriptions
        .map((chunk) => chunk.text)
        .join(" ");

      return {
        transcriptionText,
        formattedTranscriptions: mergedTranscriptions,
      };
    },
    3,
    1000,
    operationName
  );
};

async function prepareTranscriptionJob(youtubeVideos: YoutubeVideo[]): Promise<{
  videoRecords: Video[];
  pendingVideos: Video[];
}> {
  console.log(`Starting transcription of ${youtubeVideos.length} videos`);

  const videoIds = youtubeVideos.map((v) => v.youtubeId);
  const durationMap = await fetchVideoDurations(videoIds);

  const videoRecords = await createVideoRecordsFromYoutubeVideos(
    youtubeVideos,
    durationMap
  );

  const pendingVideos = videoRecords.filter((v) => v.status === "PENDING");

  return {
    videoRecords,
    pendingVideos,
  };
}

async function transcribeVideoInChunks(video: Video): Promise<{
  allTranscripts: Transcript;
  fullTranscriptionText: string;
}> {
  const allTranscripts: Transcript = [];
  const allTranscriptionTexts: string[] = [];
  const durationInSeconds = video.durationInMinutes * 60;
  const chunkDurationSeconds = 5 * 60;

  const totalChunks = Math.ceil(durationInSeconds / chunkDurationSeconds);
  console.log(`Splitting video into ${totalChunks} chunk(s)`);

  const chunkInfos = Array.from({ length: totalChunks }, (_, chunkIndex) => {
    const fromSeconds = chunkIndex * chunkDurationSeconds;
    const toSeconds = Math.min(
      (chunkIndex + 1) * chunkDurationSeconds,
      durationInSeconds
    );
    return { chunkIndex, fromSeconds, toSeconds };
  });

  const batchSize = 3;
  const results: Array<{
    chunkIndex: number;
    fromSeconds: number;
    transcriptionText: string;
    formattedTranscriptions: Transcript;
  }> = [];

  for (let i = 0; i < chunkInfos.length; i += batchSize) {
    const batch = chunkInfos.slice(i, i + batchSize);

    const batchPromises = batch.map(
      async ({ chunkIndex, fromSeconds, toSeconds }) => {
        const { transcriptionText, formattedTranscriptions } =
          await getTranscript({
            video: video.youtubeId,
            fromSeconds,
            toSeconds,
          });

        return {
          chunkIndex,
          fromSeconds,
          transcriptionText,
          formattedTranscriptions,
        };
      }
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  results.sort((a, b) => a.chunkIndex - b.chunkIndex);

  for (const {
    fromSeconds,
    transcriptionText,
    formattedTranscriptions,
  } of results) {
    allTranscriptionTexts.push(transcriptionText);

    const adjustedTranscriptions = formattedTranscriptions.map((chunk) => ({
      ...chunk,
      timestamp:
        typeof chunk.timestamp === "number"
          ? chunk.timestamp + fromSeconds
          : chunk.timestamp,
    }));

    allTranscripts.push(...adjustedTranscriptions);
  }

  const fullTranscriptionText = allTranscriptionTexts.join(" ");
  return { allTranscripts, fullTranscriptionText };
}

async function processVideoEmbedding(
  video: Video
): Promise<TranscriptionResult> {
  console.log(`Generating embeddings for video: ${video.youtubeId}`);

  const transcriptWithEmbeddings = await updateEmbeddingsForExistingChunks(
    video.id
  );

  return {
    video,
    transcript: {
      videoId: video.id,
      chunks: transcriptWithEmbeddings,
    },
    fullTranscriptionText: video.content,
  };
}

async function handleVideoTranscriptionError(
  video: Video,
  error: Error
): Promise<TranscriptionResult> {
  console.error(`Failed to transcribe ${video.youtubeId}:`, error);

  await prisma.video.update({
    where: { id: video.id },
    data: { status: "TRANSCRIBE_ERROR" },
  });

  return {
    video,
    error: error instanceof Error ? error.message : "Unknown error occurred",
  };
}

async function handleVideoEmbeddingError(
  video: Video,
  error: Error
): Promise<TranscriptionResult> {
  console.error(`Failed to embed ${video.youtubeId}:`, error);

  await prisma.video.update({
    where: { id: video.id },
    data: { status: "EMBEDDING_ERROR" },
  });

  return {
    video,
    error:
      error instanceof Error
        ? error.message
        : "Unknown embedding error occurred",
  };
}

type ProcessingContext = {
  video: Video;
  allTranscripts?: Transcript;
  fullTranscriptionText?: string;
  transcriptWithEmbeddings?: Transcript;
};

type ProcessingStep = {
  name: string;
  execute: (context: ProcessingContext) => Promise<ProcessingContext>;
};

const transcribeChunksStep: ProcessingStep = {
  name: "transcribeChunks",
  execute: async (context) => {
    if (context.video.status === "COMPLETED") {
      const existingChunks = await prisma.transcriptChunk.findMany({
        where: { videoId: context.video.id },
        orderBy: { timestampInSeconds: "asc" },
      });

      const allTranscripts = existingChunks.map((chunk) => ({
        timestamp: chunk.timestampInSeconds,
        text: chunk.text,
        embedding: null,
      }));

      return {
        ...context,
        allTranscripts,
        fullTranscriptionText: context.video.content,
      };
    }

    const { allTranscripts, fullTranscriptionText } =
      await transcribeVideoInChunks(context.video);

    return {
      ...context,
      allTranscripts,
      fullTranscriptionText,
    };
  },
};

const saveTranscriptionOnlyStep: ProcessingStep = {
  name: "saveTranscriptionOnly",
  execute: async (context) => {
    await prisma.transcriptChunk.createMany({
      data: context.allTranscripts!.map((chunk) => ({
        videoId: context.video.id,
        timestampInSeconds:
          typeof chunk.timestamp === "number"
            ? chunk.timestamp
            : parseInt(chunk.timestamp.toString(), 10),
        text: chunk.text,
      })),
    });

    await prisma.video.update({
      where: { id: context.video.id },
      data: {
        status: "COMPLETED",
        content: context.fullTranscriptionText!,
      },
    });

    return context;
  },
};

const generateEmbeddingsStep: ProcessingStep = {
  name: "generateEmbeddings",
  execute: async (context) => {
    const transcriptWithEmbeddings = await appendEmbeddings({
      videoId: context.video.id,
      transcript: context.allTranscripts!,
    });

    return {
      ...context,
      transcriptWithEmbeddings,
    };
  },
};

const saveTranscriptionStep: ProcessingStep = {
  name: "saveTranscription",
  execute: async (context) => {
    await prisma.video.update({
      where: { id: context.video.id },
      data: {
        status: "COMPLETED",
        content: context.fullTranscriptionText!,
      },
    });
    return context;
  },
};

const transcriptionOnlyPipeline: ProcessingStep[] = [
  transcribeChunksStep,
  saveTranscriptionOnlyStep,
];

const videoProcessingPipeline: ProcessingStep[] = [
  transcribeChunksStep,
  generateEmbeddingsStep,
  saveTranscriptionStep,
];

async function executeVideoProcessingPipeline(
  video: Video,
  pipeline: ProcessingStep[] = videoProcessingPipeline
): Promise<TranscriptionResult> {
  let context: ProcessingContext = { video };

  for (const step of pipeline) {
    context = await step.execute(context);
  }

  return {
    video: context.video,
    transcript: {
      videoId: context.video.id,
      chunks: context.transcriptWithEmbeddings ?? context.allTranscripts ?? [],
    },
    fullTranscriptionText: context.fullTranscriptionText!,
  };
}

async function processTranscriptionBatches(
  pendingVideos: Video[],
  batchSize: number,
  pipeline: ProcessingStep[] = transcriptionOnlyPipeline
): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];

  for (let i = 0; i < pendingVideos.length; i += batchSize) {
    const batch = pendingVideos.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pendingVideos.length / batchSize);

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} (${batch.length} videos)`
    );

    const batchPromises = batch.map(async (video) => {
      try {
        return await executeVideoProcessingPipeline(video, pipeline);
      } catch (error) {
        if (error instanceof Error) {
          return await handleVideoTranscriptionError(video, error);
        }
        throw error;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

async function processEmbeddingBatches(
  completedVideos: Video[],
  batchSize: number
): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];

  for (let i = 0; i < completedVideos.length; i += batchSize) {
    const batch = completedVideos.slice(i, i + batchSize);

    const batchPromises = batch.map(async (video) => {
      try {
        return await processVideoEmbedding(video);
      } catch (error) {
        if (error instanceof Error) {
          return await handleVideoEmbeddingError(video, error);
        }
        throw error;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

type ResultSummary = {
  successful: TranscriptionResult[];
  failed: TranscriptionResult[];
  totalAttempts: number;
  totalTranscribed: number;
};

function processTranscriptionResults(
  results: TranscriptionResult[]
): ResultSummary {
  const successful = results.filter((r) => r.transcript && !r.error);
  const failed = results.filter((r) => r.error);

  return {
    successful,
    failed,
    totalAttempts: results.length,
    totalTranscribed: successful.length,
  };
}

function categorizeVideoResultsForNotifications(
  transcriptionResults: TranscriptionResult[],
  embeddingResults: TranscriptionResult[]
): {
  transcriptionSuccesses: Video[];
  transcriptionFailures: Video[];
  embeddingSuccesses: Video[];
  embeddingFailures: Video[];
} {
  const transcriptionSuccesses: Video[] = [];
  const transcriptionFailures: Video[] = [];
  const embeddingSuccesses: Video[] = [];
  const embeddingFailures: Video[] = [];

  for (const result of transcriptionResults) {
    if (result.transcript && !result.error) {
      transcriptionSuccesses.push(result.video);
    } else if (result.error) {
      transcriptionFailures.push(result.video);
    }
  }

  for (const result of embeddingResults) {
    if (result.transcript && !result.error) {
      embeddingSuccesses.push(result.video);
    } else if (result.error) {
      embeddingFailures.push(result.video);
    }
  }

  return {
    transcriptionSuccesses,
    transcriptionFailures,
    embeddingSuccesses,
    embeddingFailures,
  };
}

export const transcribeVideos = async ({
  youtubeVideos,
  batchSize = 5,
}: {
  youtubeVideos: YoutubeVideo[];
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalTranscribed: number;
  processedVideos: Video[];
}> => {
  console.log(
    `Starting two-phase transcription for ${youtubeVideos.length} videos`
  );

  const { videoRecords, pendingVideos } =
    await prepareTranscriptionJob(youtubeVideos);

  const transcriptionResults = await processTranscriptionBatches(
    pendingVideos,
    batchSize,
    transcriptionOnlyPipeline
  );

  const transcriptionSummary =
    processTranscriptionResults(transcriptionResults);

  const successfullyTranscribed = transcriptionSummary.successful.map(
    (r) => r.video
  );
  let embeddingResults: TranscriptionResult[] = [];

  if (successfullyTranscribed.length > 0) {
    embeddingResults = await processEmbeddingBatches(
      successfullyTranscribed,
      batchSize
    );
  }

  const embeddingSummary = processTranscriptionResults(embeddingResults);
  const allResults = [...transcriptionResults, ...embeddingResults];
  const finalSummary = processTranscriptionResults(allResults);

  try {
    const categorizedResults = categorizeVideoResultsForNotifications(
      transcriptionResults,
      embeddingResults
    );

    await createTranscriptionNotifications(categorizedResults);
  } catch (error) {
    console.error("Failed to create transcription notifications:", error);
  }

  return {
    totalAttempts: finalSummary.totalAttempts,
    totalTranscribed: embeddingSummary.totalTranscribed,
    processedVideos: videoRecords,
  };
};

export const transcribeExistingVideo = async ({
  videos,
  batchSize = 5,
}: {
  videos: Video[];
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalTranscribed: number;
  processedVideos: Video[];
}> => {
  const videosToProcess = await prepareExistingVideos(videos);

  const results = await processTranscriptionBatches(
    videosToProcess,
    batchSize,
    videoProcessingPipeline
  );

  const resultSummary = processTranscriptionResults(results);

  try {
    const categorizedResults = categorizeVideoResultsForNotifications(
      results,
      []
    );

    await createTranscriptionNotifications(categorizedResults);
  } catch (error) {
    console.error("Failed to create transcription notifications:", error);
  }

  return {
    totalAttempts: resultSummary.totalAttempts,
    totalTranscribed: resultSummary.totalTranscribed,
    processedVideos: videos,
  };
};

export const transcribeVideosOnly = async ({
  youtubeVideos,
  batchSize = 5,
}: {
  youtubeVideos: YoutubeVideo[];
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalTranscribed: number;
  processedVideos: Video[];
}> => {
  const { videoRecords, pendingVideos } =
    await prepareTranscriptionJob(youtubeVideos);

  const results = await processTranscriptionBatches(
    pendingVideos,
    batchSize,
    transcriptionOnlyPipeline
  );

  const resultSummary = processTranscriptionResults(results);

  try {
    const categorizedResults = categorizeVideoResultsForNotifications(
      results,
      []
    );

    await createTranscriptionNotifications(categorizedResults);
  } catch (error) {
    console.error("Failed to create transcription notifications:", error);
  }

  return {
    totalAttempts: resultSummary.totalAttempts,
    totalTranscribed: resultSummary.totalTranscribed,
    processedVideos: videoRecords,
  };
};

export const generateEmbeddingsForVideos = async ({
  videos,
  batchSize = 5,
}: {
  videos: Video[];
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalEmbedded: number;
  processedVideos: Video[];
}> => {
  const videosReadyForEmbedding = await prepareVideosForEmbedding(videos);

  if (videosReadyForEmbedding.length === 0) {
    return {
      totalAttempts: 0,
      totalEmbedded: 0,
      processedVideos: videos,
    };
  }

  const results = await processEmbeddingBatches(
    videosReadyForEmbedding,
    batchSize
  );

  const resultSummary = processTranscriptionResults(results);

  try {
    const categorizedResults = categorizeVideoResultsForNotifications(
      [],
      results
    );

    await createTranscriptionNotifications(categorizedResults);
  } catch (error) {
    console.error("Failed to create embedding notifications:", error);
  }

  return {
    totalAttempts: resultSummary.totalAttempts,
    totalEmbedded: resultSummary.totalTranscribed,
    processedVideos: videos,
  };
};

export const retryVideo = async ({
  videoId,
}: {
  videoId: string;
}): Promise<{
  success: boolean;
  action: "transcribe" | "embed" | "none";
  error?: string;
}> => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    return {
      success: false,
      action: "none",
      error: "Video not found",
    };
  }

  console.log(`Retrying video ${video.youtubeId} with status ${video.status}`);

  try {
    if (video.status === "TRANSCRIBE_ERROR") {
      await prisma.transcriptChunk.deleteMany({
        where: { videoId: video.id },
      });

      const resetVideo = await prisma.video.update({
        where: { id: video.id },
        data: {
          status: "PENDING",
          content: "",
        },
      });

      const result = await executeVideoProcessingPipeline(
        resetVideo,
        videoProcessingPipeline
      );

      try {
        const categorizedResults = categorizeVideoResultsForNotifications(
          [result],
          []
        );

        await createTranscriptionNotifications(categorizedResults);
      } catch (error) {
        console.error("Failed to create retry notification:", error);
      }

      return {
        success: !result.error,
        action: "transcribe",
        error: result.error,
      };
    } else if (video.status === "EMBEDDING_ERROR") {
      const result = await processVideoEmbedding(video);

      try {
        const categorizedResults = categorizeVideoResultsForNotifications(
          [],
          [result]
        );

        await createTranscriptionNotifications(categorizedResults);
      } catch (error) {
        console.error("Failed to create embedding retry notification:", error);
      }

      return {
        success: !result.error,
        action: "embed",
        error: result.error,
      };
    } else {
      return {
        success: false,
        action: "none",
        error: `Video status ${video.status} does not need retry`,
      };
    }
  } catch (error) {
    return {
      success: false,
      action: video.status === "TRANSCRIBE_ERROR" ? "transcribe" : "embed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
