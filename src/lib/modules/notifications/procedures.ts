import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import {
  createNotification,
  getNotificationsForUser,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  batchDeleteNotifications,
  deleteAllReadNotifications,
  deleteAllNotificationsForUser,
} from "./helpers";
import { NotificationType } from "@/generated/prisma";

export const notificationsRouter = createTRPCRouter({
  // Create a new notification
  createNotification: baseProcedure
    .input(
      z.object({
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
        type: z.nativeEnum(NotificationType),
        message: z.string().min(1, { message: "Message is required." }),
      })
    )
    .mutation(async ({ input: { userEmail, type, message } }) => {
      return createNotification({ userEmail, type, message });
    }),

  // Get all notifications for a user with optional filtering
  getNotificationsForUser: baseProcedure
    .input(
      z.object({
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
        read: z.boolean().optional(),
        type: z.nativeEnum(NotificationType).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input: { userEmail, read, type, limit, offset } }) => {
      return getNotificationsForUser(userEmail, { read, type, limit, offset });
    }),

  // Get unread notification count for a user
  getUnreadNotificationCount: baseProcedure
    .input(
      z.object({
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      return getUnreadNotificationCount(userEmail);
    }),

  // Mark a single notification as read
  markNotificationAsRead: baseProcedure
    .input(
      z.object({
        notificationId: z
          .string()
          .min(1, { message: "Notification ID is required." }),
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { notificationId, userEmail } }) => {
      return markNotificationAsRead(notificationId, userEmail);
    }),

  // Mark all notifications as read for a user
  markAllNotificationsAsRead: baseProcedure
    .input(
      z.object({
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { userEmail } }) => {
      return markAllNotificationsAsRead(userEmail);
    }),

  // Delete a single notification
  deleteNotification: baseProcedure
    .input(
      z.object({
        notificationId: z
          .string()
          .min(1, { message: "Notification ID is required." }),
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { notificationId, userEmail } }) => {
      return deleteNotification(notificationId, userEmail);
    }),

  // Batch delete multiple notifications
  batchDeleteNotifications: baseProcedure
    .input(
      z.object({
        notificationIds: z
          .array(z.string().min(1, { message: "Notification ID is required." }))
          .min(1, { message: "At least one notification ID is required." }),
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { notificationIds, userEmail } }) => {
      return batchDeleteNotifications(notificationIds, userEmail);
    }),

  // Delete all read notifications for a user
  deleteAllReadNotifications: baseProcedure
    .input(
      z.object({
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { userEmail } }) => {
      return deleteAllReadNotifications(userEmail);
    }),

  // Delete all notifications for a user (cleanup function)
  deleteAllNotificationsForUser: baseProcedure
    .input(
      z.object({
        userEmail: z
          .string()
          .email({ message: "Valid user email is required." }),
      })
    )
    .mutation(async ({ input: { userEmail } }) => {
      return deleteAllNotificationsForUser(userEmail);
    }),
});
