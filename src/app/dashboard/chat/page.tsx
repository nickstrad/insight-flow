import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import Chat from "@/lib/modules/chats/components/chat";
import DashboardPageHeader from "@/components/DashboardPageHeader";

const Page = async () => {
  return (
    <>
      <DashboardPageHeader
        title="Insight Flow Chat"
        description="Chat with AI about your transcribed videos and get insights"
      />

      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading chat...</div>}>
          <Chat />
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default Page;
