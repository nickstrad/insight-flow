import { ErrorBoundary } from "react-error-boundary";
import { VideoSearch } from "@/lib/modules/videos/components/VideoSearch/VideoSearch";
import DashboardPageHeader from "@/components/DashboardPageHeader";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { currentUser } from "@clerk/nextjs/server";

const Page = async () => {
  const user = await currentUser();
  const userEmail = user?.emailAddresses[0]?.emailAddress ?? ''; // Access the primary email address

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    trpc.quotas.getQuota.queryOptions({
      userEmail,
    })
  );

  return (
    <>
      <DashboardPageHeader
        title="Video Search & Transcription"
        description="Search YouTube channels and transcribe videos to build your knowledge base"
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
          <VideoSearch userEmail={userEmail} />
        </ErrorBoundary>
      </HydrationBoundary>
    </>
  );
};

export default Page;
