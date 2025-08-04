import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { handleUserQuery } from "./helpers";

export const messageRouter = createTRPCRouter({
  handleUserQuery: baseProcedure
    .input(
      z.object({
        userEmail: z.string().min(1, { message: "User email is required." }),
        query: z.string().min(1, { message: "Query is required." }),
        chatId: z.string().min(1, { message: "Chat ID is required." }),
      })
    )
    .mutation(async ({ input: { userEmail, query, chatId } }) => {
      return handleUserQuery({
        userEmail,
        query,
        chatId,
      });
    }),
});
