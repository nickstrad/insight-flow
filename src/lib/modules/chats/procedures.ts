import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  createChat,
  getChatById,
  getChatsByUserAndChannel,
  updateChatTitle,
  deleteChat,
} from ".";

export const chatRouter = createTRPCRouter({
  create: baseProcedure
    .input(
      z.object({
        userEmail: z.string().email({ message: "Valid email is required." }),
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
        title: z.string().min(1, { message: "Title is required." }),
      })
    )
    .mutation(async ({ input: { userEmail, channelHandle, title } }) => {
      return createChat({ userEmail, channelHandle, title });
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

  getByUserAndChannel: baseProcedure
    .input(
      z.object({
        userEmail: z.string().email({ message: "Valid email is required." }),
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
      })
    )
    .query(async ({ input: { userEmail, channelHandle } }) => {
      return (
        (await getChatsByUserAndChannel({ userEmail, channelHandle })) ?? []
      );
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
});
