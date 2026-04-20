import { prisma } from "@/db";
import { Chat, ChatMessage } from "@/generated/prisma";
import { GoogleGenAI } from "@google/genai";

export async function createChat({
  uid,
  title,
}: {
  uid: string;
  title: string;
}): Promise<Chat> {
  const chat = await prisma.chat.create({
    data: {
      uid,
      title,
    },
  });
  return chat;
}

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

export async function getChatByUid({
  uid,
}: {
  uid: string;
}): Promise<Array<Chat & { messages: ChatMessage[] }> | null> {
  return await prisma.chat.findMany({
    where: {
      uid,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

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

export async function deleteChat(id: string): Promise<void> {
  await prisma.chatMessage.deleteMany({
    where: { chatId: id },
  });

  await prisma.chat.delete({
    where: { id },
  });
}

const API_KEY = process.env.GOOGLE_API_KEY!;
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function createChatWithFirstMessage({
  uid,
  firstMessage,
}: {
  uid: string;
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

    const finalTitle =
      title.length > 50 ? title.substring(0, 47) + "..." : title;

    return await createChat({ uid, title: finalTitle });
  } catch (error) {
    console.error("Failed to generate chat title:", error);
    const words = firstMessage.split(" ").slice(0, 4);
    const fallbackTitle = words.join(" ") + (words.length === 4 ? "..." : "");

    return await createChat({ uid, title: fallbackTitle });
  }
}

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

export async function getChatContext({ id }: { id: string }): Promise<{
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
