import { prisma } from "@/db";
import { retryWithBackoff } from "@/lib/utils";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GOOGLE_API_KEY!;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Types for embeddings
export type TranscriptChunk = {
  timestamp: number | string;
  text: string;
  embedding: number[] | null;
};

export type Transcript = TranscriptChunk[];

// Generate embeddings for text arrays with retry logic and batching
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
      const batchStartIndex = (i + groupIndex) * batchSize;
      const operationName = `Generate embeddings for batch ${batchStartIndex}-${
        batchStartIndex + batch.length - 1
      }`;

      return await retryWithBackoff(
        async () => {
          const response = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: batch,
          });

          if (!response.embeddings || response.embeddings.length === 0) {
            throw new Error("Empty embeddings response from Gemini API");
          }

          const batchEmbeddings = response.embeddings.map(
            (embedding) => embedding.values
          );
          const startIndex = (i + groupIndex) * batchSize;

          // Place embeddings in correct positions
          batchEmbeddings.forEach((embedding, embeddingIndex) => {
            allEmbeddings[startIndex + embeddingIndex] = embedding;
          });

          return batchEmbeddings;
        },
        3,
        1000,
        operationName
      );
    });

    await Promise.all(promises);
  }

  return allEmbeddings;
};

// Store transcript chunks with embeddings in database
export const appendEmbeddings = async ({
  videoId,
  transcript,
}: {
  videoId: string;
  transcript: Transcript;
}) => {
  console.log(
    `  =
 Generating embeddings for ${transcript.length} transcript chunks`
  );
  const embeddings = await getEmbeddings(transcript.map((t) => t.text));

  const newTranscript = transcript.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings?.[i] || null,
  }));

  console.log(`  =� Storing transcript chunks with embeddings to database`);
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

// Update existing transcript chunks with embeddings
export const updateEmbeddingsForExistingChunks = async (videoId: string) => {
  // Get existing transcript chunks for this video
  const existingChunks = await prisma.transcriptChunk.findMany({
    where: { videoId },
    orderBy: { timestampInSeconds: "asc" },
  });

  if (existingChunks.length === 0) {
    throw new Error("No transcript chunks found for video");
  }

  console.log(
    `  =
 Generating embeddings for ${existingChunks.length} existing transcript chunks`
  );

  const embeddings = await getEmbeddings(
    existingChunks.map((chunk) => chunk.text)
  );

  console.log(`  =� Updating transcript chunks with embeddings in database`);

  // Update each chunk with its embedding
  for (let i = 0; i < existingChunks.length; i++) {
    const chunk = existingChunks[i];
    const embedding = embeddings?.[i];

    await prisma.$executeRaw`
      UPDATE "TranscriptChunk" 
      SET embedding = ${embedding ? `[${embedding.join(",")}]` : null}::vector
      WHERE id = ${chunk.id}
    `;
  }

  return existingChunks.map((chunk, i) => ({
    ...chunk,
    timestamp: chunk.timestampInSeconds,
    text: chunk.text,
    embedding: embeddings?.[i] || null,
  }));
};
