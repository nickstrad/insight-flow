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
import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Video, AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PaginatedVideoList from "./PaginatedVideoList";
import { useRouter } from "next/navigation";

interface VideoTableProps {
  channelHandle: string;
  playlistId?: string;
  searchType: "channel" | "playlist";
  onLoadingStateChange?: (isLoading: boolean) => void;
}

export default function PurchaseVideoTable({
  channelHandle,
  playlistId,
  searchType,
  onLoadingStateChange,
}: VideoTableProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  );
  const trpc = useTRPC();
  const router = useRouter();

  const {
    pagination: {
      currentPage,
      totalPages,
      totalVideoCount,
      previousPage,
      nextPage,
      canGoBack,
      canGoForward,
    },
    data: { currentVideos, isLoading },
    error: { apiError, clearError },
  } = useVideoTableState({ channelHandle, playlistId, searchType });

  useEffect(() => {
    if (onLoadingStateChange) {
      onLoadingStateChange(isLoading);
    }
  }, [isLoading, onLoadingStateChange]);

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
      setSelectedVideoIds(new Set(currentVideos.map((v) => v.youtubeId)));
    } else {
      setSelectedVideoIds(new Set());
    }
  };

  const selectedVideos = currentVideos.filter((video) =>
    selectedVideoIds.has(video.youtubeId)
  );

  const transcriptionMutation = useMutation(
    trpc.transcriptions.transcribeVideos.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Transcription started! Processing ${data.videoCount} videos.`
        );

        setIsConfirmModalOpen(false);
        setSelectedVideoIds(new Set());

        router.push("/dashboard/videos");
      },
      onError: (error) => {
        toast.error(`Transcription failed: ${error.message}`);
      },
    })
  );

  const handleTranscribe = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmTranscription = async () => {
    if (selectedVideos.length === 0) return;

    try {
      await transcriptionMutation.mutateAsync({
        youtubeVideos: selectedVideos,
        batchSize: 5,
      });
    } catch (error) {
      console.error("Transcription error:", error);
    }
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
        {apiError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{apiError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="text-destructive hover:text-destructive/90 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedVideoIds.size} video
            {selectedVideoIds.size !== 1 ? "s" : ""} selected
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
                  checked={
                    currentVideos.length > 0 &&
                    selectedVideoIds.size === currentVideos.length
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all videos"
                  disabled={isLoading}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>YouTube ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Thumbnail</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  Loading videos...
                </TableCell>
              </TableRow>
            ) : currentVideos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  No videos found for{" "}
                  {searchType === "channel"
                    ? `channel ${channelHandle}`
                    : `playlist ${playlistId}`}
                </TableCell>
              </TableRow>
            ) : (
              currentVideos.map((video) => {
                const isSelected = selectedVideoIds.has(video.youtubeId);

                return (
                  <TableRow key={video.youtubeId}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleVideoSelection(video.youtubeId, !!checked)
                        }
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
                          className="h-12 w-16 rounded object-cover"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {video.durationInMinutes ? (
                          <div className="font-medium">
                            {video.durationInMinutes} min
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        {(currentVideos.length > 0 || totalPages > 1) && (
          <div className="flex w-full items-center justify-between">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={canGoBack && !isLoading ? previousPage : undefined}
                    isActive={canGoBack && !isLoading}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="mx-4 text-sm text-gray-700">
                    {isLoading
                      ? "Loading..."
                      : `Page ${currentPage} of ${totalPages} (${totalVideoCount} videos)`}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={canGoForward && !isLoading ? nextPage : undefined}
                    isActive={canGoForward && !isLoading}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardFooter>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl p-0">
          <div className="flex h-full max-h-[calc(90vh-2rem)] flex-col">
            <DialogHeader className="flex-shrink-0 border-b px-6 py-4 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Confirm Video Transcription
              </DialogTitle>
              <DialogDescription>
                Review the videos you want to transcribe.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      Selected Videos ({selectedVideos.length})
                    </h4>
                    <Badge variant="secondary">
                      {selectedVideos.length} videos
                    </Badge>
                  </div>

                  <div className="rounded-lg border p-3">
                    <PaginatedVideoList
                      videos={selectedVideos}
                      itemsPerPage={5}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-background flex flex-shrink-0 justify-end space-x-2 border-t p-6 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={transcriptionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmTranscription}
                disabled={
                  transcriptionMutation.isPending || selectedVideos.length === 0
                }
              >
                {transcriptionMutation.isPending
                  ? "Starting Transcription..."
                  : "Start Transcription"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
