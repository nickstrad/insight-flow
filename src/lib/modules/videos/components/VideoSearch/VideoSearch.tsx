"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import QuotaViewer from "@/lib/modules/quota/components/QuotaViewer";

export const VideoSearch = ({ userEmail }: { userEmail: string }) => {
  const [channelHandle, setChannelHandle] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [submittedHandle, setSubmittedHandle] = useState("");
  const [submittedPlaylistId, setSubmittedPlaylistId] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchType, setSearchType] = useState<"channel" | "playlist">("channel");
  const [isLoading, setIsLoading] = useState(false);

  const handleChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelHandle.trim()) {
      setSubmittedHandle(channelHandle.trim());
      setSubmittedPlaylistId("");
      setSearchType("channel");
      setIsSubmitted(true);
    }
  };

  const handlePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistId.trim()) {
      setSubmittedPlaylistId(playlistId.trim());
      setSubmittedHandle("");
      setSearchType("playlist");
      setIsSubmitted(true);
    }
  };

  const handleLoadingStateChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Search YouTube Channel</CardTitle>
            <CardDescription>
              Enter a YouTube channel handle to view and select videos for
              transcription.
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
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Enter the channel handle (e.g., @channelname)
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={!channelHandle.trim() || isLoading}
                className="w-full"
              >
                {isLoading && searchType === "channel" ? "Searching..." : "Search Channel Videos"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search YouTube Playlist</CardTitle>
            <CardDescription>
              Enter a YouTube playlist ID to view and select videos for
              transcription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePlaylistSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlistId">YouTube Playlist ID</Label>
                <Input
                  id="playlistId"
                  type="text"
                  placeholder="PLxxxxxxxxxxxxxxxxxxxx"
                  value={playlistId}
                  onChange={(e) => setPlaylistId(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Enter the playlist ID (found in the playlist URL)
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={!playlistId.trim() || isLoading}
                className="w-full"
              >
                {isLoading && searchType === "playlist" ? "Searching..." : "Search Playlist Videos"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Video Selection</h3>
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">
              Loading quota...
            </div>
          }
        >
          <QuotaViewer userEmail={userEmail} />
        </Suspense>
      </div>
      {isSubmitted && (
        <Suspense fallback={<VideoTableSkeleton />}>
          <PurchaseVideoTable
            channelHandle={searchType === "channel" ? submittedHandle : ""}
            playlistId={searchType === "playlist" ? submittedPlaylistId : ""}
            searchType={searchType}
            userEmail={userEmail}
            onLoadingStateChange={handleLoadingStateChange}
          />
        </Suspense>
      )}
    </div>
  );
};

const VideoTableSkeleton = () => (
  <Card className="min-h-[600px] flex flex-col">
    <CardHeader>
      <CardTitle>Videos</CardTitle>
      <CardDescription>
        A list of all the videos in your channel.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">Loading videos...</div>
        <Button disabled>Transcribe Selected Videos</Button>
      </div>

      <div className="flex-1 min-h-0">
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
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="w-16 h-12 bg-gray-200 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
    <CardFooter>
      <div className="flex items-center justify-between w-full">
        <span className="mx-4 text-sm text-gray-700">Loading...</span>
      </div>
    </CardFooter>
  </Card>
);
