import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { handleUserQuery } from "./helpers";

export const messageRouter = createTRPCRouter({
  handleUserQuery: baseProcedure
    .input(
      z.object({
        query: z.string().min(1, { message: "Query is required." }),
        chatId: z.string().min(1, { message: "Chat ID is required." }),
      })
    )
    .mutation(async ({ input: { query, chatId } }) => {
      return handleUserQuery({
        query,
        chatId,
      });
    }),
});
