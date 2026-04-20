"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function NotificationWidget() {
  const trpc = useTRPC();

  const { data: unreadCount = 0 } = useQuery(
    trpc.notifications.getUnreadNotificationCount.queryOptions()
  );

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Badge
      className={`ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0 text-xs font-medium ${
        unreadCount > 0
          ? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          : "bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
      } `}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </Badge>
  );
}
