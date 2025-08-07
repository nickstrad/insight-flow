import { prisma } from "@/db";
import { Chat, ChatMessage } from "@/generated/prisma";
import { GoogleGenAI } from "@google/genai";

// Create
export async function createChat({
  userEmail,
  title,
}: {
  userEmail: string;
  title: string;
}): Promise<Chat> {
  const chat = await prisma.chat.create({
    data: {
      userEmail,
      title,
    },
  });
  return chat;
}

// Read
export async function getChatById(
  id: string
): Promise<(Chat & { messages: ChatMessage[] }) | null> {
  return await prisma.chat.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function getChatByUserEmail({
  userEmail,
}: {
  userEmail: string;
}): Promise<Array<Chat & { messages: ChatMessage[] }> | null> {
  return await prisma.chat.findMany({
    where: {
      userEmail,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1, // Just get the first message for preview
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

// Update
export async function updateChatTitle({
  id,
  title,
}: {
  id: string;
  title: string;
}): Promise<Chat> {
  return await prisma.chat.update({
    where: { id },
    data: { title },
  });
}

// Delete
export async function deleteChat(id: string): Promise<void> {
  // Delete messages first (due to foreign key constraint)
  await prisma.chatMessage.deleteMany({
    where: { chatId: id },
  });

  // Then delete the chat
  await prisma.chat.delete({
    where: { id },
  });
}

const API_KEY = process.env.GOOGLE_API_KEY!;
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function createChatWithFirstMessage({
  userEmail,
  firstMessage,
}: {
  userEmail: string;
  firstMessage: string;
}): Promise<Chat> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        `Generate a concise 4 to 6 word title for a chat conversation that starts with this message: "${firstMessage}". 
         The title should capture the main topic or intent. Return only the title, no quotes or additional text.`,
      ],
    });

    const title = response.text?.trim() || "New Chat";

    // Ensure title is reasonable length (max 50 chars for safety)
    const finalTitle =
      title.length > 50 ? title.substring(0, 47) + "..." : title;

    // Create the chat with the generated title
    return await createChat({ userEmail, title: finalTitle });
  } catch (error) {
    console.error("Failed to generate chat title:", error);
    // Fallback to a simple title based on first few words
    const words = firstMessage.split(" ").slice(0, 4);
    const fallbackTitle = words.join(" ") + (words.length === 4 ? "..." : "");

    // Create the chat with the fallback title
    return await createChat({ userEmail, title: fallbackTitle });
  }
}

// Update chat channel handles and playlist IDs
export async function updateChatContext({
  id,
  channelHandles,
  playlistIds,
}: {
  id: string;
  channelHandles?: string[];
  playlistIds?: string[];
}): Promise<Chat> {
  const updateData: {
    channelHandles?: string[];
    playlistIds?: string[];
  } = {};

  if (channelHandles !== undefined) {
    updateData.channelHandles = channelHandles;
  }

  if (playlistIds !== undefined) {
    updateData.playlistIds = playlistIds;
  }

  return await prisma.chat.update({
    where: { id },
    data: updateData,
  });
}

// Get chat context (channel handles and playlist IDs)
export async function getChatContext({
  id,
}: {
  id: string;
}): Promise<{
  channelHandles: string[];
  playlistIds: string[];
} | null> {
  const chat = await prisma.chat.findUnique({
    where: { id },
    select: {
      channelHandles: true,
      playlistIds: true,
    },
  });

  if (!chat) {
    return null;
  }

  return {
    channelHandles: chat.channelHandles || [],
    playlistIds: chat.playlistIds || [],
  };
}
