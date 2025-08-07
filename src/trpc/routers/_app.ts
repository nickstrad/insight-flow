import { createTRPCRouter } from "../init";
import { transcriptRouter } from "@/lib/modules/transcriptions/procedures";
import { chatRouter } from "@/lib/modules/chats/procedures";
import { messageRouter } from "@/lib/modules/messages/procedures";
import { videosRouter } from "@/lib/modules/videos/procedures";
import { quotasRouter } from "@/lib/modules/quota/procedures";
import { notificationsRouter } from "@/lib/modules/notifications/procedures";

export const appRouter = createTRPCRouter({
  transcriptions: transcriptRouter,
  videos: videosRouter,
  chats: chatRouter,
  messages: messageRouter,
  quotas: quotasRouter,
  notifications: notificationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
