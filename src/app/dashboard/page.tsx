import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import { VideoSearch } from "@/lib/modules/videos/components/VideoSearch/VideoSearch";

const Page = async () => {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Suspense fallback={<div>Loading videos...</div>}>
        <VideoSearch />
      </Suspense>
    </ErrorBoundary>
  );
};

export default Page;
