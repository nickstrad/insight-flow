"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { clientConfig } from "@/lib/config";

const NOTIFICATIONS_PATH = "/dashboard/notifications";

export default function NotificationWidget() {
  const trpc = useTRPC();
  const pathname = usePathname();
  const refetchInterval = pathname?.startsWith(NOTIFICATIONS_PATH)
    ? clientConfig.NEXT_PUBLIC_NOTIFICATION_PAGE_POLL_MS
    : clientConfig.NEXT_PUBLIC_NOTIFICATION_POLL_MS;

  const { data: unreadCount = 0 } = useQuery({
    ...trpc.notifications.getUnreadNotificationCount.queryOptions(),
    refetchInterval,
  });

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
