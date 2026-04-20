import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  createChat,
  getChatById,
  getChatByUid,
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
        uid: z.string().min(1, { message: "uid is required." }),
        title: z.string().min(1, { message: "Title is required." }),
      })
    )
    .mutation(async ({ input: { uid, title } }) => {
      return createChat({ uid, title });
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

  getByUid: baseProcedure
    .input(
      z.object({
        uid: z.string().min(1, { message: "uid is required." }),
      })
    )
    .query(async ({ input: { uid } }) => {
      return (await getChatByUid({ uid })) ?? [];
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
        uid: z.string().min(1, { message: "uid is required." }),
        firstMessage: z
          .string()
          .min(1, { message: "First message is required." }),
      })
    )
    .mutation(async ({ input: { uid, firstMessage } }) => {
      return await createChatWithFirstMessage({ uid, firstMessage });
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
