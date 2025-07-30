import { prisma } from "@/db";
import { Chat, ChatMessage } from "@/generated/prisma";

// Create
export async function createChat({
  userEmail,
  channelHandle,
  title,
}: {
  userEmail: string;
  channelHandle: string;
  title: string;
}): Promise<Chat> {
  const chat = await prisma.chat.create({
    data: {
      userEmail,
      channelHandle,
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

export async function getChatsByUserAndChannel({
  userEmail,
  channelHandle,
}: {
  userEmail: string;
  channelHandle: string;
}): Promise<Array<Chat & { messages: ChatMessage[] }> | null> {
  return await prisma.chat.findMany({
    where: {
      userEmail,
      channelHandle,
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
