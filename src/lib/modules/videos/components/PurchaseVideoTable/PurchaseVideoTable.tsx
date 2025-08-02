"use client";

import { useVideoTableState } from "./hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";

interface VideoTableProps {
  channelHandle: string;
}

export default function PurchaseVideoTable({ channelHandle }: VideoTableProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const {
    pagination: { currentPage, totalPages, handlePreviousPage, handleNextPage },
    data: { currentVideos, videos },
    handleSort,
    getSortIcon,
  } = useVideoTableState({ channelHandle });

  const handleVideoSelection = (videoId: string, isSelected: boolean) => {
    const newSelectedIds = new Set(selectedVideoIds);
    if (isSelected) {
      newSelectedIds.add(videoId);
    } else {
      newSelectedIds.delete(videoId);
    }
    setSelectedVideoIds(newSelectedIds);
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedVideoIds(new Set(currentVideos.map(v => v.youtubeId)));
    } else {
      setSelectedVideoIds(new Set());
    }
  };

  const selectedVideos = currentVideos.filter(video => selectedVideoIds.has(video.youtubeId));

  const handleTranscribe = () => {
    setIsConfirmModalOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Videos</CardTitle>
        <CardDescription>
          A list of all the videos in your channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            {selectedVideoIds.size} video{selectedVideoIds.size !== 1 ? 's' : ''} selected
          </div>
          <Button
            type="button"
            onClick={handleTranscribe}
            disabled={selectedVideoIds.size === 0}
          >
            Transcribe Selected Videos
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={currentVideos.length > 0 && selectedVideoIds.size === currentVideos.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all videos"
                />
              </TableHead>
              <TableHead onClick={() => handleSort("title")}>
                Title {getSortIcon("title")}
              </TableHead>
              <TableHead onClick={() => handleSort("youtubeId")}>
                YouTube ID {getSortIcon("youtubeId")}
              </TableHead>
              <TableHead>
                Description
              </TableHead>
              <TableHead>
                Thumbnail
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentVideos.map((video) => (
              <TableRow key={video.youtubeId}>
                <TableCell>
                  <Checkbox
                    checked={selectedVideoIds.has(video.youtubeId)}
                    onCheckedChange={(checked) => handleVideoSelection(video.youtubeId, !!checked)}
                    aria-label={`Select ${video.title}`}
                  />
                </TableCell>
                <TableCell>
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {video.title}
                  </a>
                </TableCell>
                <TableCell>{video.youtubeId}</TableCell>
                <TableCell className="max-w-md">
                  <div className="truncate">
                    {video.description || "No description"}
                  </div>
                </TableCell>
                <TableCell>
                  {video.thumbnail && (
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-16 h-12 object-cover rounded"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {videos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No videos found for {channelHandle}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        {videos.length > 0 && (
          <div className="flex items-center justify-between w-full">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={currentPage === 1 ? undefined : handlePreviousPage}
                    isActive={currentPage !== 1}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="mx-4 text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={
                      currentPage === totalPages ? undefined : handleNextPage
                    }
                    isActive={currentPage !== totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardFooter>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Transcription</DialogTitle>
            <DialogDescription>
              <div className="space-y-4">
                <p>You are about to transcribe {selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''}:</p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {selectedVideos.map(video => (
                    <div key={video.youtubeId} className="text-sm p-2 bg-gray-50 rounded">
                      {video.title}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  This is a placeholder confirmation modal. The actual transcription functionality will be implemented later.
                </p>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    // TODO: Implement actual transcription logic
                    console.log('Transcribing videos:', selectedVideos);
                    setIsConfirmModalOpen(false);
                    setSelectedVideoIds(new Set());
                  }}>
                    Confirm Transcription
                  </Button>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
