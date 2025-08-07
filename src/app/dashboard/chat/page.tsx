import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import Chat from "@/lib/modules/chats/components/chat";
import { currentUser } from "@clerk/nextjs/server";
import DashboardPageHeader from "@/components/DashboardPageHeader";

const Page = async () => {
  const user = await currentUser();
  const userEmail = user?.emailAddresses[0]?.emailAddress!; // Access the primary email address

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.chats.getByUserEmail.queryOptions({
      userEmail,
    })
  );

  void queryClient.prefetchQuery(
    trpc.videos.getAllChannelsForUser.queryOptions({
      userEmail,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardPageHeader
        title="Insight Flow Chat"
        description="Chat with AI about your transcribed videos and get insights"
      />

      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading chat...</div>}>
          <Chat userEmail={userEmail} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
