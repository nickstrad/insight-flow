import { prisma } from "@/db";
import { Video } from "@/generated/prisma";
import { GoogleGenAI } from "@google/genai";
import { toGeminiSchema } from "gemini-zod";
import z from "zod";

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
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  return (response.embeddings ?? []).map((embedding) => embedding.values);
};

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

export const transcribeNextN = async (
  n: number = 10,
  batchSize: number = 5
): Promise<{ totalAttempts: number; totalTranscribed: number }> => {
  console.log(
    `🎯 Starting transcription of next ${n} videos (batch size: ${batchSize})`
  );

  // Fetch pending videos from database
  const videos: Video[] = await prisma.video.findMany({
    where: {
      status: "PENDING",
    },
    take: n,
  });
  console.log(`📋 Found ${videos.length} pending videos to process`);

  if (videos.length === 0) {
    console.log("✅ No pending videos found - nothing to transcribe");
    return { totalAttempts: 0, totalTranscribed: 0 };
  }

  const results: TranscriptionResult[] = [];

  // Process videos in batches to avoid API rate limits
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(videos.length / batchSize);

    console.log(
      `🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} videos)`
    );

    // Process batch in parallel for better performance
    const batchPromises = batch.map(
      async (video): Promise<TranscriptionResult> => {
        console.log(
          `  📹 Transcribing video: ${video.youtubeId} (${
            video.title || "Untitled"
          }) - ${video.durationInMinutes} minutes`
        );
        try {
          // Step 1: Split video into 30-minute chunks and get transcripts
          const allTranscripts: Transcript = [];
          const allTranscriptionTexts: string[] = [];
          const durationInSeconds = video.durationInMinutes * 60;
          const chunkDurationSeconds = 30 * 60; // 30 minutes in seconds

          const chunks = Math.ceil(durationInSeconds / chunkDurationSeconds);
          console.log(
            `  📝 Splitting video into ${chunks} chunk(s) of up to 30 minutes`
          );

          for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
            const fromSeconds = chunkIndex * chunkDurationSeconds;
            const toSeconds = Math.min(
              (chunkIndex + 1) * chunkDurationSeconds,
              durationInSeconds
            );

            console.log(
              `    🎬 Transcribing chunk ${
                chunkIndex + 1
              }/${chunks} (${fromSeconds}s-${toSeconds}s)`
            );

            const { transcriptionText, formattedTranscriptions } =
              await getTranscript({
                video: video.youtubeId,
                fromSeconds,
                toSeconds,
              });

            // Store the transcription text for this chunk
            allTranscriptionTexts.push(transcriptionText);

            // Adjust timestamps to be relative to the full video
            const adjustedTranscriptions = formattedTranscriptions.map(
              (chunk) => ({
                ...chunk,
                timestamp:
                  typeof chunk.timestamp === "number"
                    ? chunk.timestamp + fromSeconds
                    : chunk.timestamp,
              })
            );

            allTranscripts.push(...adjustedTranscriptions);
          }

          console.log(
            `  ✅ Got transcript with ${allTranscripts.length} chunks for ${video.youtubeId}`
          );

          // Step 2: Generate embeddings for each transcript chunk and store in DB
          const transcriptWithEmbeddings = await appendEmbeddings({
            videoId: video.id,
            transcript: allTranscripts,
          });
          console.log(
            `  🔗 Added embeddings to transcript for ${video.youtubeId}`
          );

          // Step 3: Concatenate all transcription texts
          const fullTranscriptionText = allTranscriptionTexts.join(" ");
          console.log(
            `  📄 Full transcription length: ${fullTranscriptionText.length} characters`
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
          console.error(`  ❌ Failed to transcribe ${video.youtubeId}:`, error);
          return {
            video,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          };
        }
      }
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    console.log(`  ✅ Batch ${batchNumber} completed`);
  }

  // Separate successful and failed results for database updates
  const successful = results.filter((r) => r.transcript && !r.error);
  const failed = results.filter((r) => r.error);

  console.log(
    `📊 Results: ${successful.length} successful, ${failed.length} failed`
  );

  // Update successful videos to COMPLETED status and save full transcription
  if (successful.length > 0) {
    console.log(
      `💾 Updating ${successful.length} videos to COMPLETED status with full transcription`
    );

    // Update each video individually to set the content field
    for (const result of successful) {
      await prisma.video.update({
        where: {
          id: result.video.id,
        },
        data: {
          status: "COMPLETED",
          content: result.fullTranscriptionText || "",
        },
      });
    }
  }

  // Batch update failed videos to FAILED status
  if (failed.length > 0) {
    console.log(`💾 Updating ${failed.length} videos to FAILED status`);
    console.log(
      `❌ Failed videos: ${failed.map((f) => f.video.youtubeId).join(", ")}`
    );
    await prisma.video.updateMany({
      where: {
        id: {
          in: failed.map((r) => r.video.id),
        },
      },
      data: {
        status: "FAILED",
      },
    });
  }

  console.log(
    `🏁 Transcription complete: ${successful.length}/${results.length} videos transcribed successfully`
  );

  return {
    totalAttempts: results.length,
    totalTranscribed: successful.length,
  };
};
