import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  batchDeleteNotifications,
  deleteAllReadNotifications,
  deleteAllNotifications,
} from "./helpers";
import { NotificationType } from "@/generated/prisma";

export const notificationsRouter = createTRPCRouter({
  createNotification: baseProcedure
    .input(
      z.object({
        type: z.nativeEnum(NotificationType),
        message: z.string().min(1, { message: "Message is required." }),
      })
    )
    .mutation(async ({ input: { type, message } }) => {
      return createNotification({ type, message });
    }),

  getNotificationsForUser: baseProcedure
    .input(
      z
        .object({
          read: z.boolean().optional(),
          type: z.nativeEnum(NotificationType).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getNotifications(input);
    }),

  getUnreadNotificationCount: baseProcedure.query(async () => {
    return getUnreadNotificationCount();
  }),

  markNotificationAsRead: baseProcedure
    .input(
      z.object({
        notificationId: z
          .string()
          .min(1, { message: "Notification ID is required." }),
      })
    )
    .mutation(async ({ input: { notificationId } }) => {
      return markNotificationAsRead(notificationId);
    }),

  markAllNotificationsAsRead: baseProcedure.mutation(async () => {
    return markAllNotificationsAsRead();
  }),

  deleteNotification: baseProcedure
    .input(
      z.object({
        notificationId: z
          .string()
          .min(1, { message: "Notification ID is required." }),
      })
    )
    .mutation(async ({ input: { notificationId } }) => {
      return deleteNotification(notificationId);
    }),

  batchDeleteNotifications: baseProcedure
    .input(
      z.object({
        notificationIds: z
          .array(z.string().min(1, { message: "Notification ID is required." }))
          .min(1, { message: "At least one notification ID is required." }),
      })
    )
    .mutation(async ({ input: { notificationIds } }) => {
      return batchDeleteNotifications(notificationIds);
    }),

  deleteAllReadNotifications: baseProcedure.mutation(async () => {
    return deleteAllReadNotifications();
  }),

  deleteAllNotifications: baseProcedure.mutation(async () => {
    return deleteAllNotifications();
  }),
});
