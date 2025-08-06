import { prisma } from "@/db";
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, MessageRole } from "@/generated/prisma";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { getEmbeddings } from "../embeddings/helpers";

type RetrievedChunk = {
  text: string;
  score: number;
  timestampInSeconds: number;
  videoId: string;
  youtubeId: string;
};

const API_KEY = process.env.GOOGLE_API_KEY!;

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = z.object({
  response: z.string().describe("The synthesized response to the user's query"),
  sources: z
    .array(
      z.object({
        url: z.string().describe("YouTube URL with timestamp"),
        relevance: z.number().describe("Relevance score as percentage"),
        text: z.string().describe("Relevant text from the source"),
      })
    )
    .describe("List of sources cited in the response"),
});

const parser = StructuredOutputParser.fromZodSchema(responseSchema);

export async function searchVideos(
  userEmail: string,
  queryText: string,
  limit: number = 5
): Promise<RetrievedChunk[]> {
  const [queryEmbedding = []] = await getEmbeddings([queryText]);
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  // Use raw SQL since pgvector operations aren't supported in Prisma ORM
  const results = await prisma.$queryRaw<
    Array<{
      text: string;
      score: number;
      timestampInSeconds: number;
      videoId: string;
      youtubeId: string;
    }>
  >`
    SELECT
      tc.text,
      1 - (tc.embedding <=> ${vectorLiteral}::vector) as score,
      tc."timestampInSeconds",
      tc."videoId",
      v."youtubeId"
    FROM "TranscriptChunk" tc
    JOIN "Video" v ON tc."videoId" = v.id
    WHERE v.status = 'COMPLETED' AND v."userEmail" = ${userEmail}  -- Only search through successfully transcribed videos from specific user
    ORDER BY tc.embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;

  return results;
}

export const makeChatCall = async ({
  query,
  chunks,
  previousMessages,
}: {
  query: string;
  chunks: RetrievedChunk[];
  previousMessages: ChatMessage[];
}) => {
  const prompt = `You are a helpful assistant that synthesizes information from multiple sources. 
Given the following search query and relevant text chunks, create a coherent and informative response.
Only use information from the provided chunks. If the chunks don't contain relevant information, say so.

Please provide a well-structured response that:
1. Directly addresses the query
2. Synthesizes information from none, one, or multiple relevant chunks
3. Maintains context and coherence
4. Cites the source's inline with YouTube video id
5. Acknowledges if certain aspects of the query aren't covered in the provided chunks
6. Appends numbered list of sources at the end, formatted as a youtube video url with timestamp


<context>
  <user_message>
  ${query}
  </user_message>

  <relevant_documents>:
  ${chunks
    .map(
      (chunk, i) => `
  <document>
      <relevance>${Math.round(chunk.score * 100)}%</relevance>
      <youtube_url>
      https://www.youtube.com/watch?v=${chunk.youtubeId}&t=${
        chunk.timestampInSeconds
      }s
      </youtube_url>
      <timestampInSeconds>${chunk.timestampInSeconds}</timestampInSeconds>
      <text>${chunk.text}</text>
  </document>
  `
    )
    .join("\n")}
  </relevant_documents>
  <previous_messages>
  ${previousMessages
    .map(
      (msg) => `
    <message>
      <role>${msg.role}</role>
      <content>${msg.message}</content>
      <createdAt>${msg.createdAt}</createdAt>
    </message>`
    )
    .join("\n")}
  </previous_messages>
</context>

`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: [prompt],
  });

  return response.text ?? "";
};

export const makeChatCallBKUP = async ({
  query,
  chunks,
  previousMessages,
}: {
  query: string;
  chunks: RetrievedChunk[];
  previousMessages: string;
}) => {
  const formatInstructions = parser.getFormatInstructions();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-lite",
    apiKey: API_KEY,
  });

  const prompt = `You are a helpful assistant that synthesizes information from multiple sources. 
Given the following search query and relevant text chunks, create a coherent and informative response.
Only use information from the provided chunks. If the chunks don't contain relevant information, say so.

Search Query: "${query}"

Relevant Chunks:
${chunks
  .map(
    (chunk, i) => `
Chunk ${i + 1} (Relevance: ${Math.round(chunk.score * 100)}%):
${chunk.text}
Source youtube video id:${chunk.youtubeId}
Source timestamp in seconds:${chunk.timestampInSeconds}
`
  )
  .join("\n")}

Context:
${previousMessages}

Please provide a well-structured response that:
1. Directly addresses the query
2. Synthesizes information from the most relevant chunks
3. Maintains context and coherence
4. Places a citation number next to each source, formatted as [videoId]
5. Acknowledges if certain aspects of the query aren't covered in the provided chunks

${formatInstructions}`;

  const response = await model.invoke(prompt);
  const parsedResponse = await parser.parse(response.content as string);

  console.log("Parsed Response:", parsedResponse);
  return parsedResponse;
};

export async function handleUserQuery({
  userEmail,
  query,
  chatId,
}: {
  userEmail: string;
  query: string;
  chatId: string;
}): Promise<{
  chatId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  chunks: RetrievedChunk[];
}> {
  // 1. Find or create chat for this user and channel
  let chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      userEmail,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        take: 5, // Limit to last 20 messages for context
      },
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  // 2. Search for relevant video chunks
  const chunks = await searchVideos(chat.userEmail, query);

  // 3. Get previous messages for context

  // 4. Generate assistant response
  const assistantResponse = await makeChatCall({
    query,
    chunks,
    previousMessages: chat.messages,
  });

  // 5. Save user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      chatId: chat.id,
      role: MessageRole.USER,
      message: query,
    },
  });

  // 6. Save assistant response
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      chatId: chat.id,
      role: MessageRole.ASSISTANT,
      message: JSON.stringify(assistantResponse),
    },
  });

  return {
    chatId: chat.id,
    userMessage,
    assistantMessage,
    chunks,
  };
}
