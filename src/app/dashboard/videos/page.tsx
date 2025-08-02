import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import VideoTable from "@/lib/modules/videos/components/VideoTable_OLD/VideoTable";
import { currentUser } from "@clerk/nextjs/server";

const Page = async () => {
  const user = await currentUser();
  const userEmail = user?.emailAddresses[0]?.emailAddress!; // Access the primary email address

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.videos.getAll.queryOptions({
      userEmail,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading videos...</div>}>
          <VideoTable userEmail={userEmail} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
