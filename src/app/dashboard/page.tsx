import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import { VideoSearch } from "@/lib/modules/videos/components/VideoSearch/VideoSearch";
import DashboardPageHeader from "@/components/DashboardPageHeader";

const Page = async () => {
  return (
    <>
      <DashboardPageHeader 
        title="Video Search & Transcription"
        description="Search YouTube channels and transcribe videos to build your knowledge base"
      />
      
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading videos...</div>}>
          <VideoSearch />
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default Page;
