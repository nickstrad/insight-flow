import { prisma } from "@/db";
import { Chat, ChatMessage } from "@/generated/prisma";

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
