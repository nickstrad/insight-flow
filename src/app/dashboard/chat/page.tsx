import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import Chat from "@/lib/modules/chats/components/chat";
import { currentUser } from "@clerk/nextjs/server";

const Page = async () => {
  const user = await currentUser();
  const userEmail = user?.emailAddresses[0]?.emailAddress!; // Access the primary email address

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.chats.getByUserEmail.queryOptions({
      userEmail,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading videos...</div>}>
          <Chat userEmail={userEmail} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;
