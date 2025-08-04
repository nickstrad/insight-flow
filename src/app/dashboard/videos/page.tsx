import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import VideoTable from "@/lib/modules/videos/components/VideoTable/VideoTable";
import { currentUser } from "@clerk/nextjs/server";
import DashboardPageHeader from "@/components/DashboardPageHeader";

const Page = async () => {
  const user = await currentUser();
  const userEmail = user?.emailAddresses[0]?.emailAddress!; // Access the primary email address

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.videos.getStoredVideosForChannel.queryOptions({
      userEmail,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardPageHeader
        title="My Videos"
        description="View and manage your transcribed video library"
      />

      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading videos...</div>}>
          <VideoTable userEmail={userEmail} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
