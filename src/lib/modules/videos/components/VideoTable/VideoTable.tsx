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
import { SquareArrowOutUpRight, Trash2, RefreshCcw, Loader2 } from "lucide-react";
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedVideoForDelete, setSelectedVideoForDelete] = useState<string | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  // Retry video mutation (smart retry based on status)
  const retryVideoMutation = useMutation(
    trpc.transcriptions.retryVideo.mutationOptions({
      onSuccess: (data) => {
        if (data.success) {
          const actionText = data.action === 'transcribe' 
            ? 'Re-transcription' 
            : data.action === 'embed' 
            ? 'Re-embedding' 
            : 'Processing';
          toast.success(`${actionText} started successfully!`);
        } else {
          toast.error(`Retry failed: ${data.error}`);
        }
        
        // Invalidate videos query to refresh the table
        queryClient.invalidateQueries(
          trpc.videos.getStoredVideosForChannel.queryOptions({ userEmail })
        );
        
        setIsRetryModalOpen(false);
        setSelectedVideoForRetry(null);
      },
      onError: (error) => {
        toast.error(`Retry failed: ${error.message}`);
      },
    })
  );
  
  // Delete video mutation
  const deleteVideoMutation = useMutation(
    trpc.videos.deleteStoredVideo.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Video deleted successfully! ${data.quotaRestored > 0 ? `${data.quotaRestored}h quota restored.` : ''}`
        );
        
        // Invalidate videos query to refresh the table
        queryClient.invalidateQueries(
          trpc.videos.getStoredVideosForChannel.queryOptions({ userEmail })
        );
        
        setIsDeleteModalOpen(false);
        setSelectedVideoForDelete(null);
      },
      onError: (error) => {
        toast.error(`Delete failed: ${error.message}`);
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
      await retryVideoMutation.mutateAsync({
        videoId: selectedVideoForRetry,
        userEmail,
      });
    } catch (error) {
      // Error handling is already done in the mutation options
      console.error('Retry video error:', error);
    }
  };
  
  const handleDeleteClick = (videoId: string) => {
    setSelectedVideoForDelete(videoId);
    setIsDeleteModalOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!selectedVideoForDelete) return;
    
    try {
      await deleteVideoMutation.mutateAsync({
        videoId: selectedVideoForDelete,
        userEmail,
      });
    } catch (error) {
      // Error handling is already done in the mutation options
      console.error('Delete video error:', error);
    }
  };
  
  // Get the selected video to show status-specific retry message
  const selectedVideo = currentVideos.find(v => v.id === selectedVideoForRetry);
  const selectedVideoForDeletion = currentVideos.find(v => v.id === selectedVideoForDelete);
  const getRetryMessage = (status: string) => {
    switch (status) {
      case 'TRANSCRIBE_ERROR':
        return 'This will reset the video status and attempt full transcription and embedding again.';
      case 'EMBEDDING_ERROR':
        return 'This will attempt to generate embeddings for the already transcribed video.';
      case 'FAILED': // Legacy status
        return 'This will reset the video status and attempt transcription again.';
      default:
        return 'This will retry processing the video.';
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
              <TableHead>
                Thumbnail
              </TableHead>
              <TableHead onClick={() => handleSort("channelHandle")}>
                Channel {getSortIcon("channelHandle")}
              </TableHead>
              <TableHead onClick={() => handleSort("playlistId")}>
                Playlist ID {getSortIcon("playlistId")}
              </TableHead>
              <TableHead onClick={() => handleSort("playlistTitle")}>
                Playlist Title {getSortIcon("playlistTitle")}
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
                <TableCell>
                  {video.thumbnailUrl ? (
                    <img 
                      src={video.thumbnailUrl} 
                      alt={`Thumbnail for ${video.title}`}
                      className="w-16 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                      No Image
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {video.channelHandle ? (
                    <a
                      href={`https://www.youtube.com/${video.channelHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {video.channelHandle}
                    </a>
                  ) : (
                    'Unknown'
                  )}
                </TableCell>
                <TableCell>
                  {video.playlistId ? (
                    <a
                      href={`https://www.youtube.com/playlist?list=${video.playlistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:underline"
                    >
                      {video.playlistId}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-gray-600">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  {video.playlistTitle || <span className="text-gray-500 italic">No playlist title</span>}
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
                <TableCell>{video.durationInMinutes} min</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      video.status === "COMPLETED"
                        ? "default"
                        : video.status === "TRANSCRIBE_ERROR" ||
                          video.status === "EMBEDDING_ERROR"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {video.status === 'TRANSCRIBE_ERROR' ? 'TRANSCRIPTION FAILED' :
                     video.status === 'EMBEDDING_ERROR' ? 'EMBEDDING FAILED' :
                     video.status}
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
                    {(video.status === "TRANSCRIBE_ERROR" || 
                      video.status === "EMBEDDING_ERROR") && (
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => handleRetryClick(video.id)}
                          variant="ghost"
                          size="icon"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title={`Retry ${video.status === 'EMBEDDING_ERROR' ? 'embedding' : 'transcription'}`}
                          disabled={retryVideoMutation.isPending}
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        {retryVideoMutation.isPending && selectedVideoForRetry === video.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                        )}
                      </div>
                    )}
                    <Button
                      onClick={() => handleDeleteClick(video.id)}
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete video"
                      disabled={deleteVideoMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {videos.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center">
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
            <AlertDialogTitle>
              Retry Video {selectedVideo?.status === 'EMBEDDING_ERROR' ? 'Embedding' : 'Transcription'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retry processing this video? {selectedVideo ? getRetryMessage(selectedVideo.status) : ''} This action will consume quota if successful.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={retryVideoMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRetry}
              disabled={retryVideoMutation.isPending}
            >
              {retryVideoMutation.isPending ? "Retrying..." : 
               `Retry ${selectedVideo?.status === 'EMBEDDING_ERROR' ? 'Embedding' : 'Processing'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Video
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this video? This action will permanently remove the video, its transcript chunks, embeddings, and restore any quota that was used. This action cannot be undone.
              {selectedVideoForDeletion && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                  <strong>Video:</strong> {selectedVideoForDeletion.title}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVideoMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={deleteVideoMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteVideoMutation.isPending ? "Deleting..." : "Delete Video"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
