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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Video, AlertCircle } from "lucide-react";
import PaginatedVideoList from "./PaginatedVideoList";

interface VideoTableProps {
  channelHandle: string;
}

export default function PurchaseVideoTable({ channelHandle }: VideoTableProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const { user } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const {
    pagination: { currentPage, totalPages, handlePreviousPage, handleNextPage },
    data: { currentVideos, videos },
    handleSort,
    getSortIcon,
  } = useVideoTableState({ channelHandle });
  
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  const handleVideoSelection = (videoId: string, isSelected: boolean) => {
    const video = currentVideos.find(v => v.youtubeId === videoId);
    
    if (isSelected && video && !canSelectVideo(video)) {
      toast.warning(`Cannot select this video - it would exceed your quota of ${quota?.videoHoursLeft || 0} hours`);
      return;
    }

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
      // Only select videos that fit within quota
      const selectableVideos = [];
      let runningTotalMinutes = selectedVideoMinutes;
      
      for (const video of currentVideos) {
        if (selectedVideoIds.has(video.youtubeId)) {
          selectableVideos.push(video.youtubeId);
          continue;
        }
        
        const newTotalMinutes = runningTotalMinutes + (video.durationInMinutes || 0);
        const newTotalHours = Math.ceil(newTotalMinutes / 60);
        
        if (quota && newTotalHours <= quota.videoHoursLeft) {
          selectableVideos.push(video.youtubeId);
          runningTotalMinutes = newTotalMinutes;
        }
      }
      
      setSelectedVideoIds(new Set(selectableVideos));
      
      if (selectableVideos.length < currentVideos.length) {
        toast.warning(`Only selected ${selectableVideos.length} of ${currentVideos.length} videos due to quota limits`);
      }
    } else {
      setSelectedVideoIds(new Set());
    }
  };

  const selectedVideos = currentVideos.filter(video => selectedVideoIds.has(video.youtubeId));

  // Fetch quota data
  const { data: quota, isLoading: quotaLoading } = useQuery({
    ...trpc.quotas.getQuota.queryOptions({ userEmail: userEmail! }),
    enabled: !!userEmail,
  });

  // Calculate selected video minutes and convert to hours only at the end
  const selectedVideoMinutes = selectedVideos.reduce((total, video) => {
    return total + (video.durationInMinutes || 0);
  }, 0);
  
  const selectedVideoHours = Math.ceil(selectedVideoMinutes / 60);

  // Function to check if a video can be selected without exceeding quota
  const canSelectVideo = (video: any) => {
    if (!quota) return true;
    const newTotalMinutes = selectedVideoMinutes + (video.durationInMinutes || 0);
    const newTotalHours = Math.ceil(newTotalMinutes / 60);
    return newTotalHours <= quota.videoHoursLeft;
  };

  // Check if quota is exceeded or at limit
  const isQuotaExceeded = quota ? selectedVideoHours >= quota.videoHoursLeft : false;
  const remainingQuota = quota ? quota.videoHoursLeft - selectedVideoHours : 0;

  // Transcription mutation
  const transcriptionMutation = useMutation(
    trpc.transcriptions.transcribeVideos.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Transcription started! Processing ${data.totalAttempts} videos.`);
        
        // Invalidate quota query to refresh quota data
        if (userEmail) {
          queryClient.invalidateQueries(
            trpc.quotas.getQuota.queryOptions({ userEmail })
          );
        }
        
        setIsConfirmModalOpen(false);
        setSelectedVideoIds(new Set());
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
    if (!userEmail || selectedVideos.length === 0) return;
    
    try {
      await transcriptionMutation.mutateAsync({
        youtubeVideos: selectedVideos,
        userEmail,
        batchSize: 5,
      });
    } catch (error) {
      // Error handling is already done in the mutation options
      console.error('Transcription error:', error);
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
        {/* Quota Status Message */}
        {quota && (
          <div className="mb-4">
            {isQuotaExceeded ? (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <AlertCircle className="w-4 h-4" />
                <div className="text-sm">
                  <span className="font-medium">Quota limit reached!</span> You cannot select more videos. 
                  You have selected {selectedVideoMinutes} minutes ({selectedVideoHours}h) of your {quota.videoHoursLeft}h quota.
                </div>
              </div>
            ) : remainingQuota <= 2 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <div className="text-sm">
                  <span className="font-medium">Low quota remaining!</span> Only {remainingQuota}h left. 
                  Selected: {selectedVideoMinutes} minutes (~{selectedVideoHours}h) of {quota.videoHoursLeft}h available.
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                <Clock className="w-4 h-4" />
                <div className="text-sm">
                  <span className="font-medium">Quota status:</span> Selected {selectedVideoMinutes} minutes (~{selectedVideoHours}h) of {quota.videoHoursLeft}h available 
                  ({remainingQuota}h remaining).
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            {selectedVideoIds.size} video{selectedVideoIds.size !== 1 ? 's' : ''} selected
            {quota && selectedVideoMinutes > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({selectedVideoMinutes} min ~{selectedVideoHours}h)
              </span>
            )}
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
              <TableHead>
                Duration
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentVideos.map((video) => {
              const isSelected = selectedVideoIds.has(video.youtubeId);
              const canSelect = isSelected || canSelectVideo(video);
              
              return (
                <TableRow key={video.youtubeId} className={!canSelect ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleVideoSelection(video.youtubeId, !!checked)}
                        disabled={!canSelect}
                        aria-label={`Select ${video.title}`}
                      />
                      {!canSelect && !isSelected && (
                        <span className="text-xs text-red-600">
                          Exceeds quota
                        </span>
                      )}
                    </div>
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
                <TableCell>
                  <div className="text-sm">
                    {video.durationInMinutes ? (
                      <div className="font-medium">{video.durationInMinutes} min</div>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
            {videos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
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
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="flex flex-col h-full max-h-[calc(90vh-2rem)]">
            <DialogHeader className="px-6 py-4 pb-2 flex-shrink-0 border-b">
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Confirm Video Transcription
              </DialogTitle>
              <DialogDescription>
                Review the videos you want to transcribe and check your quota usage.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* Quota Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <h4 className="font-medium">Current Quota</h4>
                  </div>
                  {quotaLoading ? (
                    <div className="text-sm text-muted-foreground">Loading quota...</div>
                  ) : quota ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Video Hours Left</div>
                        <div className="text-2xl font-bold text-blue-600">{quota.videoHoursLeft}h</div>
                        <Progress value={(quota.videoHoursLeft / 10) * 100} className="w-full" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Messages Left</div>
                        <div className="text-2xl font-bold text-green-600">{quota.messagesLeft}</div>
                        <Progress value={(quota.messagesLeft / 100) * 100} className="w-full" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Unable to load quota information</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Quota resets: {quota ? new Date(quota.resetAt).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>

                <Separator />

                {/* Video Selection Summary */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Selected Videos ({selectedVideos.length})</h4>
                    <Badge variant="secondary">
                      {selectedVideoMinutes > 0 ? `${selectedVideoMinutes} min (~${selectedVideoHours}h)` : `~${selectedVideos.length}h`}
                    </Badge>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <PaginatedVideoList videos={selectedVideos} itemsPerPage={5} />
                  </div>
                </div>

                {/* Warning if insufficient quota */}
                {quota && selectedVideoHours > quota.videoHoursLeft && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <div className="font-medium mb-1">Insufficient quota</div>
                      <div>
                        You need approximately {selectedVideoHours} hours ({selectedVideoMinutes} minutes) but only have {quota.videoHoursLeft} hours remaining. Please reduce your selection or upgrade your quota.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="flex justify-end space-x-2 p-6 pt-4 border-t bg-background flex-shrink-0">
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
                  transcriptionMutation.isPending || 
                  !quota || 
                  selectedVideos.length === 0 ||
                  selectedVideoHours > quota.videoHoursLeft
                }
              >
                {transcriptionMutation.isPending ? "Starting Transcription..." : "Start Transcription"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
