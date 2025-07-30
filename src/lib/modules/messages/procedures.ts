import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { handleUserQuery } from ".";

export const messageRouter = createTRPCRouter({
  handleUserQuery: baseProcedure
    .input(
      z.object({
        channelHandle: z
          .string()
          .min(1, { message: "Channel handle is required." }),
        query: z.string().min(1, { message: "Query is required." }),
        chatId: z.string().min(1, { message: "Chat ID is required." }),
      })
    )
    .mutation(async ({ input: { channelHandle, query, chatId } }) => {
      return handleUserQuery({
        channelHandle,
        query,
        chatId,
      });
    }),
});
