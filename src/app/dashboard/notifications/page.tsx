import { ErrorBoundary } from "react-error-boundary";
import NotificationTable from "@/lib/modules/notifications/components/NotificationTable";
import DashboardPageHeader from "@/components/DashboardPageHeader";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

const Page = async () => {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    trpc.notifications.getNotificationsForUser.queryOptions()
  );

  return (
    <>
      <DashboardPageHeader
        title="Notifications"
        description="Manage your notifications and stay updated on system activities"
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ErrorBoundary
          fallback={<div>Something went wrong loading notifications</div>}
        >
          <NotificationTable />
        </ErrorBoundary>
      </HydrationBoundary>
    </>
  );
};

export default Page;
