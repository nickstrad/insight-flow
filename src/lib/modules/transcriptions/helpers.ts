import { prisma } from "@/db";
import { Video } from "@/generated/prisma";
import { GoogleGenAI } from "@google/genai";
import { toGeminiSchema } from "gemini-zod";
import z from "zod";
import { YoutubeVideo } from "../videos/types";
import {
  getQuota,
  fetchVideoDurations,
  createVideoRecordsFromYoutubeVideos,
  calculateVideoHoursNeeded,
  checkVideoQuota,
  deductVideoQuota,
} from "../quota/helpers";
import {
  getEmbeddings,
  appendEmbeddings,
  updateEmbeddingsForExistingChunks,
  type TranscriptChunk,
  type Transcript,
} from "../embeddings/helpers";
import { retryWithBackoff } from "@/lib/utils";

// Types are now imported from embeddings/helpers

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

const API_KEY = process.env.GOOGLE_API_KEY!;

const geminiSchema = toGeminiSchema(zodSchema);

function convertTimestampToSeconds(time: string): number | null {
  try {
    // Handle both single timestamps "02:12" and ranges "02:12 - 02:28"
    // For ranges, we only need the starting timestamp
    const startTime = time.includes(" - ") ? time.split(" - ")[0].trim() : time.trim();
    const [minutesStr, secondsStr] = startTime.split(":");

    const minutes = parseInt(minutesStr, 10);
    const seconds = parseInt(secondsStr, 10);

    return minutes * 60 + seconds;
  } catch (err) {
    return null;
  }
}

// Helper function to merge transcript chunks to be at least 10 seconds each
function mergeTranscriptChunks(transcript: Transcript, minChunkDurationSeconds: number = 10): Transcript {
  if (transcript.length === 0) return transcript;
  
  const mergedChunks: Transcript = [];
  let currentChunk: TranscriptChunk | null = null;
  let currentChunkStartTime: number = 0;
  
  for (let i = 0; i < transcript.length; i++) {
    const chunk = transcript[i];
    const chunkTimestamp = typeof chunk.timestamp === 'number' 
      ? chunk.timestamp 
      : (convertTimestampToSeconds(chunk.timestamp.toString()) || 0);
    
    if (currentChunk === null) {
      // Start new chunk
      currentChunk = {
        timestamp: chunkTimestamp,
        text: chunk.text,
        embedding: null
      };
      currentChunkStartTime = chunkTimestamp;
    } else {
      // Check if we should merge with current chunk or start a new one
      const chunkDuration = chunkTimestamp - currentChunkStartTime;
      
      if (chunkDuration < minChunkDurationSeconds) {
        // Merge with current chunk
        currentChunk.text += ' ' + chunk.text;
      } else {
        // Current chunk is long enough, save it and start new one
        mergedChunks.push(currentChunk);
        currentChunk = {
          timestamp: chunkTimestamp,
          text: chunk.text,
          embedding: null
        };
        currentChunkStartTime = chunkTimestamp;
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk !== null) {
    mergedChunks.push(currentChunk);
  }
  
  return mergedChunks;
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Embedding functions are now in ../embeddings/helpers.ts

// Helper function to prepare existing videos for re-transcription
async function prepareExistingVideos(
  videos: Video[],
  userEmail: string
): Promise<{
  videosToProcess: Video[];
  totalHoursNeeded: number;
  currentQuota: any;
  shouldEarlyReturn: boolean;
  earlyReturnResult?: {
    totalAttempts: number;
    totalTranscribed: number;
    quotaExceeded: boolean;
    processedVideos: Video[];
  };
}> {
  console.log(
    `🔄 Starting re-transcription of ${videos.length} existing videos for user: ${userEmail}`
  );

  // Reset videos to PENDING status and clear existing transcript chunks
  const videosToProcess: Video[] = [];
  for (const video of videos) {
    // Delete existing transcript chunks
    await prisma.transcriptChunk.deleteMany({
      where: { videoId: video.id },
    });

    // Reset video status to PENDING and ensure channelHandle is set
    const resetVideo = await prisma.video.update({
      where: { id: video.id },
      data: {
        status: "PENDING",
        content: "",
        // If channelHandle is missing, we can't easily determine it here
        // since we only have the Video record, not the original channel info
      },
    });

    videosToProcess.push(resetVideo);
  }

  // Calculate total hours needed
  const totalHoursNeeded = videosToProcess.reduce(
    (sum, v) => sum + calculateVideoHoursNeeded(v.durationInMinutes),
    0
  );

  console.log(
    `📊 Processing ${videosToProcess.length} videos requiring ~${totalHoursNeeded} hours of quota`
  );

  // Check quota
  const currentQuota = await getQuota(userEmail);
  console.log(
    `💳 Current quota: ${currentQuota.videoHoursLeft} hours remaining`
  );

  // Validate quota
  if (videosToProcess.length === 0) {
    console.log("✅ No videos to re-transcribe");
    return {
      videosToProcess,
      totalHoursNeeded,
      currentQuota,
      shouldEarlyReturn: true,
      earlyReturnResult: {
        totalAttempts: 0,
        totalTranscribed: 0,
        quotaExceeded: false,
        processedVideos: videos,
      },
    };
  }

  if (currentQuota.videoHoursLeft <= 0) {
    console.log("❌ No video hours quota remaining");
    return {
      videosToProcess,
      totalHoursNeeded,
      currentQuota,
      shouldEarlyReturn: true,
      earlyReturnResult: {
        totalAttempts: 0,
        totalTranscribed: 0,
        quotaExceeded: true,
        processedVideos: videos,
      },
    };
  }

  return {
    videosToProcess,
    totalHoursNeeded,
    currentQuota,
    shouldEarlyReturn: false,
  };
}

// Helper function to prepare videos for embedding (videos in COMPLETED state)
async function prepareVideosForEmbedding(videos: Video[]): Promise<Video[]> {
  console.log(`🔄 Preparing ${videos.length} videos for embedding`);

  // Filter to only videos that are in COMPLETED state (transcribed but not embedded)
  const videosReadyForEmbedding = videos.filter(
    (v) => v.status === "COMPLETED"
  );

  console.log(
    `📊 Found ${videosReadyForEmbedding.length} videos ready for embedding`
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

      console.log("response.text:");
      console.log(response.text);

      if (!response.text) {
        throw new Error("Empty response from Gemini API");
      }

      const transcriptionArray = JSON.parse(response.text ?? "[]");
      const formattedTranscriptions: Transcript = transcriptionArray.map(
        (item: any) => {
          const seconds = convertTimestampToSeconds(item.timestamp);
          const transcription: TranscriptChunk = {
            timestamp: seconds !== null ? seconds : item.timestamp,
            text: item.text,
            embedding: null,
          };
          return transcription;
        }
      );

      // Merge chunks to be at least 10 seconds each
      const mergedTranscriptions = mergeTranscriptChunks(formattedTranscriptions, 10);

      const transcriptionText = mergedTranscriptions
        .map((chunk) => chunk.text)
        .join(" ");

      return { transcriptionText, formattedTranscriptions: mergedTranscriptions };
    },
    3,
    1000,
    operationName
  );
};

// 1. Extract setup/preparation logic
async function prepareTranscriptionJob(
  youtubeVideos: YoutubeVideo[],
  userEmail: string
): Promise<{
  videoRecords: Video[];
  pendingVideos: Video[];
  totalHoursNeeded: number;
  currentQuota: any;
  shouldEarlyReturn: boolean;
  earlyReturnResult?: {
    totalAttempts: number;
    totalTranscribed: number;
    quotaExceeded: boolean;
    processedVideos: Video[];
  };
}> {
  logTranscriptionStart(youtubeVideos.length, userEmail);

  // Step 1: Fetch video durations from YouTube API
  logFetchingDurations();
  const videoIds = youtubeVideos.map((v) => v.youtubeId);
  const durationMap = await fetchVideoDurations(videoIds);

  // Step 2: Create Video records in database from YoutubeVideo objects
  logCreatingRecords();
  const videoRecords = await createVideoRecordsFromYoutubeVideos(
    youtubeVideos,
    userEmail,
    durationMap
  );

  // Step 3: Filter to only pending videos and calculate total hours needed
  const pendingVideos = videoRecords.filter((v) => v.status === "PENDING");
  const totalHoursNeeded = pendingVideos.reduce(
    (sum, v) => sum + calculateVideoHoursNeeded(v.durationInMinutes),
    0
  );

  logQuotaSummary(pendingVideos.length, totalHoursNeeded);

  // Step 4: Check initial quota
  const currentQuota = await getQuota(userEmail);
  logCurrentQuota(currentQuota.videoHoursLeft);

  // Step 5: Validate quota for batch processing
  const validation = validateQuotaForBatch(
    pendingVideos,
    currentQuota,
    videoRecords
  );
  if (validation.shouldEarlyReturn) {
    return {
      videoRecords,
      pendingVideos,
      totalHoursNeeded,
      currentQuota,
      shouldEarlyReturn: true,
      earlyReturnResult: validation.earlyReturnResult,
    };
  }

  return {
    videoRecords,
    pendingVideos,
    totalHoursNeeded,
    currentQuota,
    shouldEarlyReturn: false,
  };
}

// 3. Extract video chunking & transcription logic
async function transcribeVideoInChunks(video: Video): Promise<{
  allTranscripts: Transcript;
  fullTranscriptionText: string;
}> {
  const allTranscripts: Transcript = [];
  const allTranscriptionTexts: string[] = [];
  const durationInSeconds = video.durationInMinutes * 60;
  const chunkDurationSeconds = 5 * 60; // 5 minutes in seconds

  const totalChunks = Math.ceil(durationInSeconds / chunkDurationSeconds);
  logVideoChunking(totalChunks);

  // Create chunk info array
  const chunkInfos = Array.from({ length: totalChunks }, (_, chunkIndex) => {
    const fromSeconds = chunkIndex * chunkDurationSeconds;
    const toSeconds = Math.min(
      (chunkIndex + 1) * chunkDurationSeconds,
      durationInSeconds
    );
    return { chunkIndex, fromSeconds, toSeconds };
  });

  // Process chunks in batches with controlled concurrency
  const batchSize = 3; // Process 3 chunks at a time to avoid API rate limits
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
        logChunkProgress(chunkIndex, totalChunks, fromSeconds, toSeconds);

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

  // Sort results by chunk index to maintain order
  results.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Process results in order
  for (const {
    fromSeconds,
    transcriptionText,
    formattedTranscriptions,
  } of results) {
    allTranscriptionTexts.push(transcriptionText);

    // Adjust timestamps to be relative to the full video
    const adjustedTranscriptions = formattedTranscriptions.map((chunk) => ({
      ...chunk,
      timestamp:
        typeof chunk.timestamp === "number"
          ? chunk.timestamp + fromSeconds
          : chunk.timestamp,
    }));

    allTranscripts.push(...adjustedTranscriptions);
  }

  logTranscriptComplete(allTranscripts.length, video.youtubeId);

  const fullTranscriptionText = allTranscriptionTexts.join(" ");
  return { allTranscripts, fullTranscriptionText };
}

// 2. Extract single video processing logic
async function processVideoTranscription(
  video: Video,
  userEmail: string
): Promise<TranscriptionResult> {
  // Check quota before processing this video
  const videoHoursNeeded = calculateVideoHoursNeeded(video.durationInMinutes);
  const { hasQuota, currentQuota } = await checkVideoQuota(
    userEmail,
    videoHoursNeeded
  );

  if (!hasQuota) {
    console.log(
      `⚠️ Insufficient quota for video ${video.youtubeId} (needs ${videoHoursNeeded}h, has ${currentQuota.videoHoursLeft}h)`
    );
    throw new Error("QUOTA_EXCEEDED");
  }

  console.log(
    `📹 Transcribing video: ${video.youtubeId} (${
      video.title || "Untitled"
    }) - ${video.durationInMinutes} minutes`
  );

  try {
    // Step 1: Split video into chunks and get transcripts
    const { allTranscripts, fullTranscriptionText } =
      await transcribeVideoInChunks(video);

    // Step 2: Generate embeddings for each transcript chunk and store in DB
    const transcriptWithEmbeddings = await appendEmbeddings({
      videoId: video.id,
      transcript: allTranscripts,
    });

    // Step 3: Update video status and content
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: "COMPLETED",
        content: fullTranscriptionText,
      },
    });

    // Step 4: Deduct quota
    const updatedQuota = await deductVideoQuota(userEmail, videoHoursNeeded);

    console.log(
      `  💳 Deducted ${videoHoursNeeded} hours from quota (${updatedQuota.videoHoursLeft} remaining)`
    );

    return {
      video,
      transcript: {
        videoId: video.id,
        chunks: transcriptWithEmbeddings,
      },
      fullTranscriptionText,
    };
  } catch (error) {
    // Re-throw error to be handled by processBatchesWithQuotaCheck
    throw error;
  }
}

// Process video embedding only (for already transcribed videos)
async function processVideoEmbedding(
  video: Video
): Promise<TranscriptionResult> {
  console.log(
    `🔍 Generating embeddings for video: ${video.youtubeId} (${
      video.title || "Untitled"
    })`
  );

  try {
    // Update embeddings for existing transcript chunks
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
  } catch (error) {
    // Re-throw error to be handled by batch processing
    throw error;
  }
}

// 4. Extract quota validation logic
type ValidationResult = {
  isValid: boolean;
  shouldEarlyReturn: boolean;
  earlyReturnResult?: {
    totalAttempts: number;
    totalTranscribed: number;
    quotaExceeded: boolean;
    processedVideos: Video[];
  };
};

function validateQuotaForBatch(
  pendingVideos: Video[],
  currentQuota: any,
  videoRecords: Video[]
): ValidationResult {
  if (pendingVideos.length === 0) {
    logNoPendingVideos();
    return {
      isValid: false,
      shouldEarlyReturn: true,
      earlyReturnResult: {
        totalAttempts: 0,
        totalTranscribed: 0,
        quotaExceeded: false,
        processedVideos: videoRecords,
      },
    };
  }

  if (currentQuota.videoHoursLeft <= 0) {
    logNoQuotaRemaining();
    return {
      isValid: false,
      shouldEarlyReturn: true,
      earlyReturnResult: {
        totalAttempts: 0,
        totalTranscribed: 0,
        quotaExceeded: true,
        processedVideos: videoRecords,
      },
    };
  }

  return {
    isValid: true,
    shouldEarlyReturn: false,
  };
}

// 6. Extract error handling logic
async function handleVideoTranscriptionError(
  video: Video,
  error: Error
): Promise<TranscriptionResult> {
  logTranscriptionError(video.youtubeId, error);

  // Update video to transcription failed status
  await markVideoTranscriptionFailed(video.id);

  return {
    video,
    error: error instanceof Error ? error.message : "Unknown error occurred",
  };
}

async function handleVideoEmbeddingError(
  video: Video,
  error: Error
): Promise<TranscriptionResult> {
  console.error(`  ❌ Failed to embed ${video.youtubeId}:`, error);

  // Update video to embedding failed status
  await markVideoEmbeddingFailed(video.id);

  return {
    video,
    error:
      error instanceof Error
        ? error.message
        : "Unknown embedding error occurred",
  };
}

// 5a. Extract transcription batch processing loop
async function processTranscriptionBatchesWithQuotaCheck(
  pendingVideos: Video[],
  userEmail: string,
  batchSize: number
): Promise<{
  results: TranscriptionResult[];
  quotaExceeded: boolean;
}> {
  const results: TranscriptionResult[] = [];
  let quotaExceeded = false;

  for (let i = 0; i < pendingVideos.length; i += batchSize) {
    const batch = pendingVideos.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pendingVideos.length / batchSize);

    logBatchProgress(batchNumber, totalBatches, batch.length);

    // Process each video in batch in parallel
    const batchPromises = batch.map(async (video) => {
      try {
        const result = await executeVideoProcessingPipeline(
          video,
          userEmail,
          transcriptionOnlyPipeline
        );
        return result;
      } catch (error) {
        if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
          throw error; // Re-throw to be handled at batch level
        }

        // Handle other transcription errors
        if (error instanceof Error) {
          const errorResult = await handleVideoTranscriptionError(video, error);
          return errorResult;
        } else {
          throw error;
        }
      }
    });

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
        quotaExceeded = true;
        break;
      }
      throw error;
    }

    if (quotaExceeded) {
      logQuotaExceeded();
      break;
    }

    logBatchCompleted(batchNumber);
  }

  return { results, quotaExceeded };
}

// 5b. Extract embedding batch processing loop
async function processEmbeddingBatches(
  completedVideos: Video[],
  batchSize: number
): Promise<{
  results: TranscriptionResult[];
}> {
  const results: TranscriptionResult[] = [];

  for (let i = 0; i < completedVideos.length; i += batchSize) {
    const batch = completedVideos.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(completedVideos.length / batchSize);

    console.log(
      `🔄 Processing embedding batch ${batchNumber}/${totalBatches} (${batch.length} videos)`
    );

    // Process each video in batch in parallel
    const batchPromises = batch.map(async (video) => {
      try {
        const result = await processVideoEmbedding(video);
        return result;
      } catch (error) {
        // Handle embedding errors
        if (error instanceof Error) {
          const errorResult = await handleVideoEmbeddingError(video, error);
          return errorResult;
        } else {
          throw error;
        }
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`  ✅ Embedding batch ${batchNumber} completed`);
  }

  return { results };
}

// 5. Extract batch processing loop (original for backward compatibility)
async function processBatchesWithQuotaCheck(
  pendingVideos: Video[],
  userEmail: string,
  batchSize: number
): Promise<{
  results: TranscriptionResult[];
  quotaExceeded: boolean;
}> {
  const results: TranscriptionResult[] = [];
  let quotaExceeded = false;

  for (let i = 0; i < pendingVideos.length; i += batchSize) {
    const batch = pendingVideos.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pendingVideos.length / batchSize);

    logBatchProgress(batchNumber, totalBatches, batch.length);

    // Process each video in batch in parallel
    const batchPromises = batch.map(async (video) => {
      try {
        const result = await executeVideoProcessingPipeline(video, userEmail);
        return result;
      } catch (error) {
        if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
          throw error; // Re-throw to be handled at batch level
        }

        // Handle other transcription errors
        if (error instanceof Error) {
          const errorResult = await handleVideoTranscriptionError(video, error);
          return errorResult;
        } else {
          throw error;
        }
      }
    });

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
        quotaExceeded = true;
        break;
      }
      throw error;
    }

    if (quotaExceeded) {
      logQuotaExceeded();
      break;
    }

    logBatchCompleted(batchNumber);
  }

  return { results, quotaExceeded };
}

// 7. Extract database update operations
async function markVideoCompleted(
  videoId: string,
  content: string
): Promise<void> {
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "COMPLETED",
      content: content,
    },
  });
}

async function markVideoTranscriptionFailed(videoId: string): Promise<void> {
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "TRANSCRIBE_ERROR" },
  });
}

async function markVideoEmbeddingFailed(videoId: string): Promise<void> {
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "EMBEDDING_ERROR" },
  });
}

// 9. Extract logging helper functions
function logTranscriptionStart(videoCount: number, userEmail: string): void {
  console.log(
    `🎯 Starting transcription of ${videoCount} videos for user: ${userEmail}`
  );
}

function logFetchingDurations(): void {
  console.log("🔍 Fetching video durations from YouTube API...");
}

function logCreatingRecords(): void {
  console.log("💾 Creating video records in database...");
}

function logQuotaSummary(pendingCount: number, totalHours: number): void {
  console.log(
    `📊 Found ${pendingCount} pending videos requiring ~${totalHours} hours of quota`
  );
}

function logCurrentQuota(hoursRemaining: number): void {
  console.log(`💳 Current quota: ${hoursRemaining} hours remaining`);
}

function logNoPendingVideos(): void {
  console.log("✅ No pending videos to transcribe");
}

function logNoQuotaRemaining(): void {
  console.log("❌ No video hours quota remaining");
}

function logVideoChunking(chunks: number): void {
  console.log(
    `  📝 Splitting video into ${chunks} chunk(s) of up to 30 minutes`
  );
}

function logChunkProgress(
  chunkIndex: number,
  totalChunks: number,
  fromSeconds: number,
  toSeconds: number
): void {
  console.log(
    `    🎬 Transcribing chunk ${
      chunkIndex + 1
    }/${totalChunks} (${fromSeconds}s-${toSeconds}s)`
  );
}

function logTranscriptComplete(chunkCount: number, videoId: string): void {
  console.log(`  ✅ Got transcript with ${chunkCount} chunks for ${videoId}`);
}

function logInsufficientQuota(
  videoId: string,
  needed: number,
  available: number
): void {
  console.log(
    `⚠️ Insufficient quota for video ${videoId} (needs ${needed}h, has ${available}h)`
  );
}

function logVideoTranscriptionStart(
  videoId: string,
  title: string,
  duration: number
): void {
  console.log(
    `📹 Transcribing video: ${videoId} (${
      title || "Untitled"
    }) - ${duration} minutes`
  );
}

function logQuotaDeduction(hoursUsed: number, remaining: number): void {
  console.log(
    `  💳 Deducted ${hoursUsed} hours from quota (${remaining} remaining)`
  );
}

function logTranscriptionError(videoId: string, error: Error): void {
  console.error(`  ❌ Failed to transcribe ${videoId}:`, error);
}

function logBatchProgress(
  batchNumber: number,
  totalBatches: number,
  batchLength: number
): void {
  console.log(
    `🔄 Processing batch ${batchNumber}/${totalBatches} (${batchLength} videos)`
  );
}

function logQuotaExceeded(): void {
  console.log("⚠️ Quota exceeded, stopping batch processing");
}

function logBatchCompleted(batchNumber: number): void {
  console.log(`  ✅ Batch ${batchNumber} completed`);
}

function logTranscriptionResults(
  successful: number,
  failed: number,
  quotaExceeded: boolean
): void {
  console.log(
    `📊 Results: ${successful} successful, ${failed} failed${
      quotaExceeded ? " (quota exceeded)" : ""
    }`
  );
}

function logTranscriptionComplete(successful: number, total: number): void {
  console.log(
    `🏁 Transcription complete: ${successful}/${total} videos transcribed successfully`
  );
}

// 8. Extract results processing logic
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

// 10. Create video processing pipeline pattern
type ProcessingStep = {
  name: string;
  execute: (context: ProcessingContext) => Promise<ProcessingContext>;
};

type ProcessingContext = {
  video: Video;
  userEmail: string;
  allTranscripts?: Transcript;
  fullTranscriptionText?: string;
  transcriptWithEmbeddings?: Transcript;
  videoHoursNeeded?: number;
  updatedQuota?: any;
};

const checkQuotaStep: ProcessingStep = {
  name: "checkQuota",
  execute: async (context: ProcessingContext): Promise<ProcessingContext> => {
    const videoHoursNeeded = calculateVideoHoursNeeded(
      context.video.durationInMinutes
    );
    const { hasQuota, currentQuota } = await checkVideoQuota(
      context.userEmail,
      videoHoursNeeded
    );

    if (!hasQuota) {
      logInsufficientQuota(
        context.video.youtubeId,
        videoHoursNeeded,
        currentQuota.videoHoursLeft
      );
      throw new Error("QUOTA_EXCEEDED");
    }

    logVideoTranscriptionStart(
      context.video.youtubeId,
      context.video.title,
      context.video.durationInMinutes
    );

    return {
      ...context,
      videoHoursNeeded,
    };
  },
};

const transcribeChunksStep: ProcessingStep = {
  name: "transcribeChunks",
  execute: async (context: ProcessingContext): Promise<ProcessingContext> => {
    // For transcription-only pipeline, get existing transcripts from DB if they exist
    if (context.video.status === "COMPLETED") {
      // Video already transcribed, get existing chunks
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

    // Otherwise, split video into chunks and get transcripts
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
  execute: async (context: ProcessingContext): Promise<ProcessingContext> => {
    // Save transcription chunks without embeddings
    const transcriptWithoutEmbeddings = context.allTranscripts!.map(
      (chunk) => ({
        ...chunk,
        embedding: null,
      })
    );

    // Store transcript chunks without embeddings
    for (const chunk of transcriptWithoutEmbeddings) {
      await prisma.$executeRaw`
        INSERT INTO "TranscriptChunk" (id, "timestampInSeconds", text, embedding, "videoId", "createdAt")
        VALUES (
          gen_random_uuid(),
          ${
            typeof chunk.timestamp === "number"
              ? chunk.timestamp
              : parseInt(chunk.timestamp.toString(), 10)
          },
          ${chunk.text},
          NULL,
          ${context.video.id},
          NOW()
        )
      `;
    }

    // Mark video as completed transcription (ready for embedding)
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
  execute: async (context: ProcessingContext): Promise<ProcessingContext> => {
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
  execute: async (context: ProcessingContext): Promise<ProcessingContext> => {
    await markVideoCompleted(context.video.id, context.fullTranscriptionText!);

    return context;
  },
};

const deductQuotaStep: ProcessingStep = {
  name: "deductQuota",
  execute: async (context: ProcessingContext): Promise<ProcessingContext> => {
    const updatedQuota = await deductVideoQuota(
      context.userEmail,
      context.videoHoursNeeded!
    );

    logQuotaDeduction(context.videoHoursNeeded!, updatedQuota.videoHoursLeft);

    return {
      ...context,
      updatedQuota,
    };
  },
};

// Transcription-only pipeline (Phase 1)
const transcriptionOnlyPipeline: ProcessingStep[] = [
  checkQuotaStep,
  transcribeChunksStep,
  saveTranscriptionOnlyStep,
  deductQuotaStep,
];

// Embedding-only pipeline (Phase 2)
const embeddingOnlyPipeline: ProcessingStep[] = [generateEmbeddingsStep];

// Original full pipeline (for backward compatibility)
const videoProcessingPipeline: ProcessingStep[] = [
  checkQuotaStep,
  transcribeChunksStep,
  generateEmbeddingsStep,
  saveTranscriptionStep,
  deductQuotaStep,
];

async function executeVideoProcessingPipeline(
  video: Video,
  userEmail: string,
  pipeline: ProcessingStep[] = videoProcessingPipeline
): Promise<TranscriptionResult> {
  let context: ProcessingContext = { video, userEmail };

  try {
    for (const step of pipeline) {
      context = await step.execute(context);
    }

    return {
      video: context.video,
      transcript: {
        videoId: context.video.id,
        chunks: context.transcriptWithEmbeddings!,
      },
      fullTranscriptionText: context.fullTranscriptionText!,
    };
  } catch (error) {
    // Re-throw error to be handled by processBatchesWithQuotaCheck
    throw error;
  }
}

// Main function to transcribe YoutubeVideo types with quota checking (two-phase approach)
export const transcribeVideos = async ({
  youtubeVideos,
  userEmail,
  batchSize = 5,
}: {
  youtubeVideos: YoutubeVideo[];
  userEmail: string;
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalTranscribed: number;
  quotaExceeded: boolean;
  processedVideos: Video[];
}> => {
  console.log(
    `🎥 Starting two-phase transcription process for ${youtubeVideos.length} videos`
  );

  // Step 1: Prepare transcription job (fetch durations, create records, check quota)
  const preparation = await prepareTranscriptionJob(youtubeVideos, userEmail);

  if (preparation.shouldEarlyReturn) {
    return preparation.earlyReturnResult!;
  }

  const { videoRecords, pendingVideos } = preparation;

  // PHASE 1: Transcribe all videos first
  console.log(`📝 Phase 1: Transcribing ${pendingVideos.length} videos`);
  const { results: transcriptionResults, quotaExceeded } =
    await processTranscriptionBatchesWithQuotaCheck(
      pendingVideos,
      userEmail,
      batchSize
    );

  // Process transcription results
  const transcriptionSummary =
    processTranscriptionResults(transcriptionResults);
  console.log(
    `📊 Phase 1 Results: ${
      transcriptionSummary.totalTranscribed
    } transcribed, ${transcriptionSummary.failed.length} failed${
      quotaExceeded ? " (quota exceeded)" : ""
    }`
  );

  // PHASE 2: Generate embeddings for successfully transcribed videos
  const successfullyTranscribed = transcriptionSummary.successful.map(
    (r) => r.video
  );
  let embeddingResults: TranscriptionResult[] = [];

  if (successfullyTranscribed.length > 0) {
    console.log(
      `🔍 Phase 2: Generating embeddings for ${successfullyTranscribed.length} transcribed videos`
    );
    const embeddingBatchResults = await processEmbeddingBatches(
      successfullyTranscribed,
      batchSize
    );
    embeddingResults = embeddingBatchResults.results;
  }

  // Process embedding results
  const embeddingSummary = processTranscriptionResults(embeddingResults);
  console.log(
    `📊 Phase 2 Results: ${embeddingSummary.totalTranscribed} embedded, ${embeddingSummary.failed.length} embedding failed`
  );

  // Combine all results
  const allResults = [...transcriptionResults, ...embeddingResults];
  const finalSummary = processTranscriptionResults(allResults);

  logTranscriptionComplete(
    embeddingSummary.totalTranscribed, // Only count fully completed (transcribed + embedded)
    finalSummary.totalAttempts
  );

  return {
    totalAttempts: finalSummary.totalAttempts,
    totalTranscribed: embeddingSummary.totalTranscribed, // Only fully completed videos
    quotaExceeded,
    processedVideos: videoRecords,
  };
};

// Function to re-transcribe existing Video records that failed or need re-processing
export const transcribeExistingVideo = async ({
  videos,
  userEmail,
  batchSize = 5,
}: {
  videos: Video[];
  userEmail: string;
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalTranscribed: number;
  quotaExceeded: boolean;
  processedVideos: Video[];
}> => {
  // Step 1: Prepare existing videos for re-transcription (reset status, clear chunks)
  const preparation = await prepareExistingVideos(videos, userEmail);

  if (preparation.shouldEarlyReturn) {
    return preparation.earlyReturnResult!;
  }

  const { videosToProcess } = preparation;

  // Step 2: Process videos in batches with quota checking (reuse existing batch processing)
  const { results, quotaExceeded } = await processBatchesWithQuotaCheck(
    videosToProcess,
    userEmail,
    batchSize
  );

  // Process and log results
  const resultSummary = processTranscriptionResults(results);
  logTranscriptionResults(
    resultSummary.totalTranscribed,
    resultSummary.failed.length,
    quotaExceeded
  );
  logTranscriptionComplete(
    resultSummary.totalTranscribed,
    resultSummary.totalAttempts
  );

  return {
    totalAttempts: resultSummary.totalAttempts,
    totalTranscribed: resultSummary.totalTranscribed,
    quotaExceeded,
    processedVideos: videos,
  };
};

// Standalone function to transcribe videos only (Phase 1)
export const transcribeVideosOnly = async ({
  youtubeVideos,
  userEmail,
  batchSize = 5,
}: {
  youtubeVideos: YoutubeVideo[];
  userEmail: string;
  batchSize?: number;
}): Promise<{
  totalAttempts: number;
  totalTranscribed: number;
  quotaExceeded: boolean;
  processedVideos: Video[];
}> => {
  console.log(
    `📝 Transcription-only mode: Processing ${youtubeVideos.length} videos`
  );

  // Step 1: Prepare transcription job
  const preparation = await prepareTranscriptionJob(youtubeVideos, userEmail);

  if (preparation.shouldEarlyReturn) {
    return preparation.earlyReturnResult!;
  }

  const { videoRecords, pendingVideos } = preparation;

  // Step 2: Process transcription only
  const { results, quotaExceeded } =
    await processTranscriptionBatchesWithQuotaCheck(
      pendingVideos,
      userEmail,
      batchSize
    );

  // Process and log results
  const resultSummary = processTranscriptionResults(results);
  logTranscriptionResults(
    resultSummary.totalTranscribed,
    resultSummary.failed.length,
    quotaExceeded
  );
  logTranscriptionComplete(
    resultSummary.totalTranscribed,
    resultSummary.totalAttempts
  );

  return {
    totalAttempts: resultSummary.totalAttempts,
    totalTranscribed: resultSummary.totalTranscribed,
    quotaExceeded,
    processedVideos: videoRecords,
  };
};

// Standalone function to generate embeddings only (Phase 2)
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
  console.log(`🔍 Embedding-only mode: Processing ${videos.length} videos`);

  // Prepare videos for embedding (filter to COMPLETED status)
  const videosReadyForEmbedding = await prepareVideosForEmbedding(videos);

  if (videosReadyForEmbedding.length === 0) {
    console.log("✅ No videos ready for embedding");
    return {
      totalAttempts: 0,
      totalEmbedded: 0,
      processedVideos: videos,
    };
  }

  // Process embeddings
  const { results } = await processEmbeddingBatches(
    videosReadyForEmbedding,
    batchSize
  );

  // Process and log results
  const resultSummary = processTranscriptionResults(results);
  console.log(
    `📊 Embedding Results: ${resultSummary.totalTranscribed} embedded, ${resultSummary.failed.length} failed`
  );
  console.log(
    `🏁 Embedding complete: ${resultSummary.totalTranscribed}/${resultSummary.totalAttempts} videos embedded successfully`
  );

  return {
    totalAttempts: resultSummary.totalAttempts,
    totalEmbedded: resultSummary.totalTranscribed,
    processedVideos: videos,
  };
};

// Smart retry function that determines what to do based on video status
export const retryVideo = async ({
  videoId,
  userEmail,
}: {
  videoId: string;
  userEmail: string;
}): Promise<{
  success: boolean;
  action: "transcribe" | "embed" | "none";
  error?: string;
}> => {
  // Get the video to check its status
  const video = await prisma.video.findUnique({
    where: { id: videoId, userEmail },
  });

  if (!video) {
    return {
      success: false,
      action: "none",
      error: "Video not found",
    };
  }

  console.log(
    `🔄 Retrying video ${video.youtubeId} with status ${video.status}`
  );

  try {
    if (video.status === "TRANSCRIBE_ERROR") {
      // Reset to PENDING and retry full transcription + embedding
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

      // Run full transcription + embedding pipeline
      const result = await executeVideoProcessingPipeline(
        resetVideo,
        userEmail,
        videoProcessingPipeline
      );

      return {
        success: !result.error,
        action: "transcribe",
        error: result.error,
      };
    } else if (video.status === "EMBEDDING_ERROR") {
      // Just retry embedding
      const result = await processVideoEmbedding(video);

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
