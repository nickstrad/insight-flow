import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import Chat from "@/components/chat";
import { currentUser } from "@clerk/nextjs/server";

interface Props {
  params: Promise<{
    channelHandle: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const { channelHandle } = await params;
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress; // Access the primary email address

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.chats.getByUserAndChannel.queryOptions({
      channelHandle,
      userEmail: email || "",
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading videos...</div>}>
          <Chat channelHandle={channelHandle} userEmail={email ?? ""} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
