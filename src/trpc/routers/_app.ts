import { channelRouter } from "@/lib/modules/channels/procedures";
import { createTRPCRouter } from "../init";
import { transcriptRouter } from "@/lib/modules/transcriptions/procedures";
import { chatRouter } from "@/lib/modules/chats/procedures";
import { messageRouter } from "@/lib/modules/messages/procedures";

export const appRouter = createTRPCRouter({
  transcriptions: transcriptRouter,
  videos: channelRouter,
  chats: chatRouter,
  messages: messageRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
