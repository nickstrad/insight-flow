import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  createChat,
  getChatById,
  getChatByUserEmail,
  updateChatTitle,
  deleteChat,
  createChatWithFirstMessage,
  updateChatContext,
  getChatContext,
} from "./helpers";

export const chatRouter = createTRPCRouter({
  create: baseProcedure
    .input(
      z.object({
        userEmail: z.string().email({ message: "Valid email is required." }),
        title: z.string().min(1, { message: "Title is required." }),
      })
    )
    .mutation(async ({ input: { userEmail, title } }) => {
      return createChat({ userEmail, title });
    }),

  getById: baseProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Chat ID is required." }),
      })
    )
    .query(async ({ input: { id } }) => {
      return getChatById(id);
    }),

  getByUserEmail: baseProcedure
    .input(
      z.object({
        userEmail: z.string().email({ message: "Valid email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      return (await getChatByUserEmail({ userEmail })) ?? [];
    }),

  updateTitle: baseProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Chat ID is required." }),
        title: z.string().min(1, { message: "Title is required." }),
      })
    )
    .mutation(async ({ input: { id, title } }) => {
      return updateChatTitle({ id, title });
    }),

  delete: baseProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Chat ID is required." }),
      })
    )
    .mutation(async ({ input: { id } }) => {
      await deleteChat(id);
      return { success: true };
    }),

  createChatWithFirstMessage: baseProcedure
    .input(
      z.object({
        userEmail: z.string().email({ message: "Valid email is required." }),
        firstMessage: z
          .string()
          .min(1, { message: "First message is required." }),
      })
    )
    .mutation(async ({ input: { userEmail, firstMessage } }) => {
      return await createChatWithFirstMessage({ userEmail, firstMessage });
    }),

  updateContext: baseProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Chat ID is required." }),
        channelHandles: z.array(z.string()).optional(),
        playlistIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input: { id, channelHandles, playlistIds } }) => {
      return await updateChatContext({ id, channelHandles, playlistIds });
    }),

  getContext: baseProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Chat ID is required." }),
      })
    )
    .query(async ({ input: { id } }) => {
      return await getChatContext({ id });
    }),
});
