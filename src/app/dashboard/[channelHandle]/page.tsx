import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import VideoTable from "@/components/video-table/VideoTable";

interface Props {
  params: Promise<{
    channelHandle: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const { channelHandle } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.videos.getAll.queryOptions({
      channelHandle,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading videos...</div>}>
          <VideoTable channelHandle={channelHandle} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
