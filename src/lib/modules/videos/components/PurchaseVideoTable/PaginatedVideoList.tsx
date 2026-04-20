"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { YoutubeVideo } from "../../types";

interface PaginatedVideoListProps {
  videos: YoutubeVideo[];
  itemsPerPage?: number;
}

export default function PaginatedVideoList({
  videos,
  itemsPerPage = 5,
}: PaginatedVideoListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(videos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVideos = videos.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  // Reset to first page when videos change
  useEffect(() => {
    setCurrentPage(1);
  }, [videos.length]);

  if (videos.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No videos selected
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Video List */}
      <div className="space-y-2">
        {currentVideos.map((video, index) => (
          <div
            key={video.youtubeId}
            className="bg-muted/50 flex items-start gap-3 rounded-lg p-3"
          >
            {video.thumbnail && (
              <img
                src={video.thumbnail}
                alt={video.title}
                className="h-12 w-16 flex-shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 line-clamp-2 text-sm font-medium">
                    {video.title}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    ID: {video.youtubeId}
                  </div>
                  {video.durationInMinutes && (
                    <div className="text-xs font-medium text-blue-600">
                      Duration: {video.durationInMinutes} min
                    </div>
                  )}
                  {video.description && (
                    <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {video.description}
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground flex-shrink-0 text-xs">
                  #{startIndex + index + 1}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-2">
          <div className="text-muted-foreground text-xs">
            Showing {startIndex + 1}-{Math.min(endIndex, videos.length)} of{" "}
            {videos.length} videos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-muted-foreground px-2 text-xs">
              {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
