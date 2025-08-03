"use client";

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
import { SquareArrowOutUpRight, Pencil, RefreshCcw, Loader2 } from "lucide-react";
import { useVideoTableState } from "./hooks";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VideoTableProps {
  userEmail: string;
}

export default function VideoTable({ userEmail }: VideoTableProps) {
  const {
    pagination: { currentPage, totalPages, handlePreviousPage, handleNextPage },
    state: { isModalOpen, selectedVideoText },
    data: { currentVideos, videos },
    handleSort,
    getSortIcon,
    openModal,
    closeModal,
  } = useVideoTableState({ userEmail });
  
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [selectedVideoForRetry, setSelectedVideoForRetry] = useState<string | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  // Retry transcription mutation
  const retryTranscriptionMutation = useMutation(
    trpc.transcriptions.transcribeExistingVideos.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Re-transcription started! Processing ${data.totalAttempts} videos.`);
        
        // Invalidate videos query to refresh the table
        queryClient.invalidateQueries(
          trpc.videos.getStoredVideosForChannel.queryOptions({ userEmail })
        );
        
        setIsRetryModalOpen(false);
        setSelectedVideoForRetry(null);
      },
      onError: (error) => {
        toast.error(`Re-transcription failed: ${error.message}`);
      },
    })
  );
  
  const handleRetryClick = (videoId: string) => {
    setSelectedVideoForRetry(videoId);
    setIsRetryModalOpen(true);
  };
  
  const handleConfirmRetry = async () => {
    if (!selectedVideoForRetry) return;
    
    try {
      await retryTranscriptionMutation.mutateAsync({
        videoIds: [selectedVideoForRetry],
        userEmail,
        batchSize: 1,
      });
    } catch (error) {
      // Error handling is already done in the mutation options
      console.error('Retry transcription error:', error);
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
        <Table>
          <TableHeader>
            <TableRow>
                            <TableHead onClick={() => handleSort("channelHandle")}>
                Channel {getSortIcon("channelHandle")}
              </TableHead>
              <TableHead onClick={() => handleSort("title")}>
                Title {getSortIcon("title")}
              </TableHead>
              <TableHead onClick={() => handleSort("youtubeId")}>
                YouTube ID {getSortIcon("youtubeId")}
              </TableHead>
              <TableHead onClick={() => handleSort("durationInMinutes")}>
                Duration {getSortIcon("durationInMinutes")}
              </TableHead>
              <TableHead onClick={() => handleSort("status")}>
                Status {getSortIcon("status")}
              </TableHead>
              <TableHead />
              <TableHead onClick={() => handleSort("createdAt")}>
                Created {getSortIcon("createdAt")}
              </TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentVideos.map((video) => (
              <TableRow key={video.id}>
                <TableCell>{video.channelHandle || 'Unknown'}</TableCell>
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
                <TableCell>{video.durationInMinutes} min</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      video.status === "COMPLETED"
                        ? "default"
                        : video.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {video.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="flex items-center">
                    <div className="truncate flex-1 pr-2">{video.content}</div>
                    {video.content.length > 100 && (
                      <Button
                        onClick={() => openModal(video.content)}
                        variant="ghost"
                        size="icon"
                      >
                        <SquareArrowOutUpRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(video.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => {
                        // TODO: Implement transcribe single video
                      }}
                      variant="ghost"
                      size="icon"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {video.status === "FAILED" && (
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => handleRetryClick(video.id)}
                          variant="ghost"
                          size="icon"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title="Retry transcription"
                          disabled={retryTranscriptionMutation.isPending}
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        {retryTranscriptionMutation.isPending && selectedVideoForRetry === video.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {videos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  No videos found for {userEmail}
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

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Full Content</DialogTitle>
            <DialogDescription>
              <div className="whitespace-pre-wrap break-words overflow-y-auto max-h-96">
                {selectedVideoText}
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isRetryModalOpen} onOpenChange={setIsRetryModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Video Transcription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retry transcribing this video? This will reset the video status and attempt transcription again. This action will consume quota if successful.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={retryTranscriptionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRetry}
              disabled={retryTranscriptionMutation.isPending}
            >
              {retryTranscriptionMutation.isPending ? "Retrying..." : "Retry Transcription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
