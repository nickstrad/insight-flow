"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ChannelsAndPlaylistFormProps {
  chatId: string;
  userEmail: string;
  initialChannelHandles?: string[];
  initialPlaylistIds?: string[];
  onUpdate?: (channelHandles: string[], playlistIds: string[]) => void;
}

export default function ChannelsAndPlaylistForm({
  chatId,
  userEmail,
  initialChannelHandles = [],
  initialPlaylistIds = [],
  onUpdate,
}: ChannelsAndPlaylistFormProps) {
  const [selectedChannelHandles, setSelectedChannelHandles] = useState<string[]>(initialChannelHandles);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>(initialPlaylistIds);

  const trpc = useTRPC();

  // Fetch current chat context
  const { data: currentChatContext, isLoading: isLoadingContext } = useQuery(
    trpc.chats.getContext.queryOptions({
      id: chatId,
    })
  );

  // Fetch user's channels and playlists
  const { data: channelsAndPlaylists, isLoading: isLoadingData } = useQuery(
    trpc.videos.getUserChannelsAndPlaylists.queryOptions({
      userEmail,
    })
  );

  // Update state when chat context is loaded
  useEffect(() => {
    if (currentChatContext) {
      setSelectedChannelHandles(currentChatContext.channelHandles);
      setSelectedPlaylistIds(currentChatContext.playlistIds);
    }
  }, [currentChatContext]);

  // Update chat context mutation
  const updateChatContextMutation = useMutation(
    trpc.chats.updateContext.mutationOptions({
      onError: (error: any) => {
        toast.error(`Failed to update chat context: ${error.message}`);
      },
      onSuccess: () => {
        toast.success("Chat context updated successfully!");
        onUpdate?.(selectedChannelHandles, selectedPlaylistIds);
      },
    })
  );

  // Handle channel selection
  const handleChannelChange = (channelHandle: string, checked: boolean) => {
    if (checked) {
      // Add channel and remove all playlists from that channel
      setSelectedChannelHandles(prev => [...prev, channelHandle]);
      
      // Remove all playlists from this channel
      const channelData = channelsAndPlaylists?.find(c => c.channelHandle === channelHandle);
      if (channelData) {
        const channelPlaylistIds = channelData.playlists.map(p => p.playlistId);
        setSelectedPlaylistIds(prev => prev.filter(id => !channelPlaylistIds.includes(id)));
      }
    } else {
      // Remove channel
      setSelectedChannelHandles(prev => prev.filter(h => h !== channelHandle));
    }
  };

  // Handle playlist selection
  const handlePlaylistChange = (playlistId: string, channelHandle: string, checked: boolean) => {
    if (checked) {
      // Add playlist and remove the parent channel
      setSelectedPlaylistIds(prev => [...prev, playlistId]);
      setSelectedChannelHandles(prev => prev.filter(h => h !== channelHandle));
    } else {
      // Remove playlist
      setSelectedPlaylistIds(prev => prev.filter(id => id !== playlistId));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateChatContextMutation.mutateAsync({
        id: chatId,
        channelHandles: selectedChannelHandles,
        playlistIds: selectedPlaylistIds,
      });
    } catch (error) {
      // Error is handled by the mutation's onError callback
    }
  };

  // Reset form to current chat context state
  const handleReset = () => {
    if (currentChatContext) {
      setSelectedChannelHandles(currentChatContext.channelHandles);
      setSelectedPlaylistIds(currentChatContext.playlistIds);
    } else {
      setSelectedChannelHandles(initialChannelHandles);
      setSelectedPlaylistIds(initialPlaylistIds);
    }
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedChannelHandles([]);
    setSelectedPlaylistIds([]);
  };

  if (isLoadingData || isLoadingContext) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading chat context and channels...</div>
        </CardContent>
      </Card>
    );
  }

  if (!channelsAndPlaylists || channelsAndPlaylists.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No channels or playlists found. Add some videos first.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine baseline for change detection (current context or initial props)
  const baselineChannelHandles = currentChatContext?.channelHandles || initialChannelHandles;
  const baselinePlaylistIds = currentChatContext?.playlistIds || initialPlaylistIds;

  const hasChanges = 
    JSON.stringify([...selectedChannelHandles].sort()) !== JSON.stringify([...baselineChannelHandles].sort()) ||
    JSON.stringify([...selectedPlaylistIds].sort()) !== JSON.stringify([...baselinePlaylistIds].sort());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Chat Context</CardTitle>
          <div className="flex gap-2">
            {(selectedChannelHandles.length > 0 || selectedPlaylistIds.length > 0) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearAll}
                type="button"
              >
                Clear All
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              disabled={!hasChanges}
              type="button"
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Select channels or specific playlists to focus the chat context. Selecting a channel includes all its playlists.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected items summary */}
          {(selectedChannelHandles.length > 0 || selectedPlaylistIds.length > 0) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Context:</Label>
              <div className="flex flex-wrap gap-1">
                {selectedChannelHandles.map(handle => (
                  <Badge key={handle} variant="default">
                    Channel: {handle}
                  </Badge>
                ))}
                {selectedPlaylistIds.map(playlistId => {
                  // Find the playlist info
                  const playlistInfo = channelsAndPlaylists
                    ?.flatMap(c => c.playlists)
                    .find(p => p.playlistId === playlistId);
                  const playlistTitle = playlistInfo?.playlistTitle || "Untitled Playlist";
                  return (
                    <Badge key={playlistId} variant="secondary">
                      {playlistTitle} ({playlistInfo?.videoCount || 0} videos)
                    </Badge>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}

          {/* Channels and Playlists Selection */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {channelsAndPlaylists.map(({ channelHandle, playlists }) => (
                <div key={channelHandle} className="space-y-3">
                  {/* Channel Selection */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`channel-${channelHandle}`}
                      checked={selectedChannelHandles.includes(channelHandle)}
                      onCheckedChange={(checked) => 
                        handleChannelChange(channelHandle, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`channel-${channelHandle}`}
                      className="font-medium cursor-pointer"
                    >
                      {channelHandle}
                    </Label>
                    <Badge variant="outline">
                      {playlists.reduce((sum, p) => sum + p.videoCount, 0)} videos
                    </Badge>
                  </div>

                  {/* Playlist Selection */}
                  <div className="ml-6 space-y-2">
                    {playlists.map(({ playlistId, playlistTitle, videoCount }) => (
                      <div key={playlistId} className="flex items-center space-x-2">
                        <Checkbox
                          id={`playlist-${playlistId}`}
                          checked={selectedPlaylistIds.includes(playlistId)}
                          disabled={selectedChannelHandles.includes(channelHandle)}
                          onCheckedChange={(checked) =>
                            handlePlaylistChange(playlistId, channelHandle, checked as boolean)
                          }
                        />
                        <Label 
                          htmlFor={`playlist-${playlistId}`}
                          className={`text-sm cursor-pointer ${
                            selectedChannelHandles.includes(channelHandle) 
                              ? 'text-muted-foreground' 
                              : ''
                          }`}
                        >
                          {playlistTitle || "Untitled Playlist"} ({videoCount} videos)
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!hasChanges || updateChatContextMutation.isPending}
            >
              {updateChatContextMutation.isPending ? "Updating..." : "Update Context"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}