"use client";

import React, { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import PurchaseVideoTable from "../PurchaseVideoTable/PurchaseVideoTable";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export const VideoSearch = () => {
  const [channelHandle, setChannelHandle] = useState("");
  const [submittedHandle, setSubmittedHandle] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const trpc = useTRPC();

  const handleChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelHandle.trim()) {
      setSubmittedHandle(channelHandle.trim());
      setSelectedPlaylistId("");
      setShowPlaylistDropdown(true);
      setIsSubmitted(false); // Don't show videos yet, wait for playlist selection
    }
  };

  const handleLoadingStateChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  // Fetch playlists for the submitted channel
  const {
    data: playlists,
    isLoading: playlistsLoading,
    error: playlistsError,
  } = useQuery({
    ...trpc.videos.getChannelPlaylists.queryOptions({
      channelHandle: submittedHandle,
    }),
    enabled: !!submittedHandle && showPlaylistDropdown,
  });

  const handlePlaylistSelect = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setIsSubmitted(true);
  };

  // Auto-select uploads playlist when playlists load
  React.useEffect(() => {
    if (playlists && playlists.length > 0 && !selectedPlaylistId) {
      const uploadsPlaylist = playlists.find((p) => p.title === "Uploads");
      if (uploadsPlaylist) {
        handlePlaylistSelect(uploadsPlaylist.id);
      }
    }
  }, [playlists, selectedPlaylistId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Search YouTube Channel</CardTitle>
            <CardDescription>
              Enter a channel handle to get playlists, then select a specific
              playlist to view videos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChannelSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channelHandle">YouTube Channel Handle</Label>
                <Input
                  id="channelHandle"
                  type="text"
                  placeholder="@channelname"
                  value={channelHandle}
                  onChange={(e) => setChannelHandle(e.target.value)}
                  disabled={isLoading || playlistsLoading}
                />
                <p className="text-muted-foreground text-sm">
                  Enter the channel handle (e.g., @channelname)
                </p>
              </div>
              <Button
                type="submit"
                disabled={
                  !channelHandle.trim() || isLoading || playlistsLoading
                }
                className="w-full"
              >
                {playlistsLoading
                  ? "Loading Playlists..."
                  : "Get Channel Playlists"}
              </Button>
            </form>

            {showPlaylistDropdown && playlists && playlists.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="playlist">Select Playlist</Label>
                <Select
                  onValueChange={handlePlaylistSelect}
                  value={selectedPlaylistId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a playlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {playlists.map((playlist) => (
                      <SelectItem key={playlist.id} value={playlist.id}>
                        {playlist.title} ({playlist.itemCount} videos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm">
                  The &quot;Uploads&quot; playlist is selected by default
                </p>
              </div>
            )}

            {showPlaylistDropdown && playlists && playlists.length === 0 && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
                <p className="text-sm">No playlists found for this channel.</p>
              </div>
            )}

            {playlistsError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                <p className="text-sm">
                  Failed to load playlists: {playlistsError.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {isSubmitted && selectedPlaylistId && (
        <Suspense fallback={<VideoTableSkeleton />}>
          <PurchaseVideoTable
            channelHandle={submittedHandle}
            playlistId={selectedPlaylistId}
            searchType="playlist"
            onLoadingStateChange={handleLoadingStateChange}
          />
        </Suspense>
      )}
    </div>
  );
};

const VideoTableSkeleton = () => (
  <Card className="flex min-h-[600px] flex-col">
    <CardHeader>
      <CardTitle>Videos</CardTitle>
      <CardDescription>
        A list of all the videos in your channel.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Loading videos...</div>
        <Button disabled>Transcribe Selected Videos</Button>
      </div>

      <div className="min-h-0 flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox disabled aria-label="Select all videos" />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>YouTube ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Thumbnail</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(15)].map((_, i) => (
              <TableRow key={i} className="h-16">
                <TableCell>
                  <Checkbox disabled />
                </TableCell>
                <TableCell>
                  <div className="h-4 animate-pulse rounded bg-gray-200" />
                </TableCell>
                <TableCell>
                  <div className="h-4 animate-pulse rounded bg-gray-200" />
                </TableCell>
                <TableCell>
                  <div className="h-4 animate-pulse rounded bg-gray-200" />
                </TableCell>
                <TableCell>
                  <div className="h-12 w-16 animate-pulse rounded bg-gray-200" />
                </TableCell>
                <TableCell>
                  <div className="h-4 animate-pulse rounded bg-gray-200" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
    <CardFooter>
      <div className="flex w-full items-center justify-between">
        <span className="mx-4 text-sm text-gray-700">Loading...</span>
      </div>
    </CardFooter>
  </Card>
);
