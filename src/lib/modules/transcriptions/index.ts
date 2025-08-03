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
} from "../quota/utils";

type TranscriptChunk = {
  timestamp: number | string;
  text: string;
  embedding: number[] | null;
};

type Transcript = TranscriptChunk[];

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
    timestamp: z.string().describe("The timestamp of the transcription"),
    text: z.string().describe("The transcribed text"),
  })
);

const API_KEY = process.env.GOOGLE_API_KEY!;

const geminiSchema = toGeminiSchema(zodSchema);

function convertTimestampToSeconds(time: string): number | null {
  try {
    const [minutesStr, secondsStr] = time.split(":");

    const minutes = parseInt(minutesStr, 10);
    const seconds = parseInt(secondsStr, 10);

    return minutes * 60 + seconds;
  } catch (err) {
    return null;
  }
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// This script transcribes a YouTube video using the YoutubeLoader from LangChain
export const getEmbeddings = async (text: string[]) => {
  const batchSize = 100;
  const maxConcurrent = 5;
  const allEmbeddings: (number[] | undefined)[] = new Array(text.length);

  // Create batches
  const batches: string[][] = [];
  for (let i = 0; i < text.length; i += batchSize) {
    batches.push(text.slice(i, i + batchSize));
  }

  // Process batches in groups of up to 5 concurrent calls
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const batchGroup = batches.slice(i, i + maxConcurrent);
    
    const promises = batchGroup.map(async (batch, groupIndex) => {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: batch,
      });
      
      const batchEmbeddings = (response.embeddings ?? []).map((embedding) => embedding.values);
      const startIndex = (i + groupIndex) * batchSize;
      
      // Place embeddings in correct positions
      batchEmbeddings.forEach((embedding, embeddingIndex) => {
        allEmbeddings[startIndex + embeddingIndex] = embedding;
      });
    });

    await Promise.all(promises);
  }

  return allEmbeddings;
};

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
  console.log(`💳 Current quota: ${currentQuota.videoHoursLeft} hours remaining`);

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

const appendEmbeddings = async ({
  videoId,
  transcript,
}: {
  videoId: string;
  transcript: Transcript;
}) => {
  console.log(
    `  🔍 Generating embeddings for ${transcript.length} transcript chunks`
  );
  const embeddings = await getEmbeddings(transcript.map((t) => t.text));

  const newTranscript = transcript.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings?.[i] || null,
  }));

  console.log(`  💾 Storing transcript chunks with embeddings to database`);
  // Store transcript chunks with embeddings in PostgreSQL with pgvector support
  // Use individual create operations since embedding field is Unsupported("vector") type in Prisma
  for (const chunk of newTranscript) {
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
        ${chunk.embedding ? `[${chunk.embedding.join(",")}]` : null}::vector,
        ${videoId},
        NOW()
      )
    `;
  }

  return newTranscript;
};

const getTranscript = async ({
  video,
  fromSeconds,
  toSeconds,
}: {
  video: string;
  fromSeconds: number;
  toSeconds: number;
}) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: [
      `Please transcribe this video from ${fromSeconds} seconds to ${toSeconds} seconds.`,
      {
        fileData: {
          mimeType: "video/mp4",
          fileUri: `https://www.youtube.com/watch?v=${video}`,
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

  const transcriptionText = formattedTranscriptions
    .map((chunk) => chunk.text)
    .join(" ");

  return { transcriptionText, formattedTranscriptions };
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
  const videoIds = youtubeVideos.map(v => v.youtubeId);
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
  const chunkDurationSeconds = 30 * 60; // 30 minutes in seconds

  const chunks = Math.ceil(durationInSeconds / chunkDurationSeconds);
  logVideoChunking(chunks);

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
    const fromSeconds = chunkIndex * chunkDurationSeconds;
    const toSeconds = Math.min(
      (chunkIndex + 1) * chunkDurationSeconds,
      durationInSeconds
    );

    logChunkProgress(chunkIndex, chunks, fromSeconds, toSeconds);

    const { transcriptionText, formattedTranscriptions } = await getTranscript({
      video: video.youtubeId,
      fromSeconds,
      toSeconds,
    });

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

  // Update video to failed status
  await markVideoFailed(video.id);

  return {
    video,
    error: error instanceof Error ? error.message : "Unknown error occurred",
  };
}

// 5. Extract batch processing loop
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

    // Process each video in batch sequentially
    for (const video of batch) {
      try {
        const result = await executeVideoProcessingPipeline(video, userEmail);
        results.push(result);
      } catch (error) {
        if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
          quotaExceeded = true;
          break;
        }

        // Handle other transcription errors
        if (error instanceof Error) {
          const errorResult = await handleVideoTranscriptionError(video, error);
          results.push(errorResult);
        } else {
          throw error;
        }
      }
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

async function markVideoFailed(videoId: string): Promise<void> {
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "FAILED" },
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
    const { allTranscripts, fullTranscriptionText } =
      await transcribeVideoInChunks(context.video);

    return {
      ...context,
      allTranscripts,
      fullTranscriptionText,
    };
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

// Main function to transcribe YoutubeVideo types with quota checking
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
  // Step 1: Prepare transcription job (fetch durations, create records, check quota)
  const preparation = await prepareTranscriptionJob(youtubeVideos, userEmail);

  if (preparation.shouldEarlyReturn) {
    return preparation.earlyReturnResult!;
  }

  const { videoRecords, pendingVideos } = preparation;

  // Step 2: Process videos in batches with quota checking
  const { results, quotaExceeded } = await processBatchesWithQuotaCheck(
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
