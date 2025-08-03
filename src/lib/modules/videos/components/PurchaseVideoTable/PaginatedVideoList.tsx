"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { YoutubeVideo } from "../../types";

interface PaginatedVideoListProps {
  videos: YoutubeVideo[];
  itemsPerPage?: number;
}

export default function PaginatedVideoList({ 
  videos, 
  itemsPerPage = 5 
}: PaginatedVideoListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(videos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVideos = videos.slice(startIndex, endIndex);
  
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };
  
  // Reset to first page when videos change
  useState(() => {
    setCurrentPage(1);
  }, [videos.length]);
  
  if (videos.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
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
            className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
          >
            {video.thumbnail && (
              <img 
                src={video.thumbnail} 
                alt={video.title}
                className="w-16 h-12 object-cover rounded flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium line-clamp-2 mb-1">
                    {video.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    ID: {video.youtubeId}
                  </div>
                  {video.durationInMinutes && (
                    <div className="text-xs font-medium text-blue-600">
                      Duration: {video.durationInMinutes} min
                    </div>
                  )}
                  {video.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {video.description}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">
                  #{startIndex + index + 1}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, videos.length)} of {videos.length} videos
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
            <div className="text-xs text-muted-foreground px-2">
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