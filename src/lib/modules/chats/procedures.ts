import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  createChat,
  getChatById,
  getChatByUserEmail,
  updateChatTitle,
  deleteChat,
} from ".";

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
});
