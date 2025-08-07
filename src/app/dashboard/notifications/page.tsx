import { ErrorBoundary } from "react-error-boundary";
import NotificationTable from "@/lib/modules/notifications/components/NotificationTable";
import DashboardPageHeader from "@/components/DashboardPageHeader";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { currentUser } from "@clerk/nextjs/server";

const Page = async () => {
  const user = await currentUser();
  const userEmail = user?.emailAddresses[0]?.emailAddress!;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    trpc.notifications.getNotificationsForUser.queryOptions({
      userEmail,
    })
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
          <NotificationTable userEmail={userEmail} />
        </ErrorBoundary>
      </HydrationBoundary>
    </>
  );
};

export default Page;
