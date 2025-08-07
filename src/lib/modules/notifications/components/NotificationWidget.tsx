"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface NotificationWidgetProps {
  userEmail: string;
}

export default function NotificationWidget({ userEmail }: NotificationWidgetProps) {
  const trpc = useTRPC();

  const { data: unreadCount = 0 } = useQuery(
    trpc.notifications.getUnreadNotificationCount.queryOptions({
      userEmail,
    })
  );

  if (unreadCount === 0) {
    return null; // Don't show badge when count is 0
  }

  return (
    <Badge
      className={`
        ml-auto min-w-[1.25rem] h-5 px-1.5 py-0 text-xs font-medium rounded-full
        flex items-center justify-center
        ${unreadCount > 0 
          ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600' 
          : 'bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
        }
      `}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}