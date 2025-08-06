import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { YoutubeVideo } from "../../types";

export const useVideoTableState = ({
  channelHandle,
  playlistId,
  searchType,
}: {
  channelHandle: string;
  playlistId?: string;
  searchType: "channel" | "playlist";
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadsPlaylistId, setUploadsPlaylistId] = useState<string>("");
  const [selectedVideos, setSelectedVideos] = useState<YoutubeVideo[]>([]);
  const [pageTokens, setPageTokens] = useState<Map<number, string>>(new Map());
  const [pageCache, setPageCache] = useState<Map<number, YoutubeVideo[]>>(new Map());
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideoCount, setTotalVideoCount] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const trpc = useTRPC();

  // Use the appropriate query based on search type
  const queryResult = useSuspenseQuery(
    searchType === "channel"
      ? trpc.videos.getUploadsMetadataForChannel.queryOptions({
          channelHandle,
        })
      : trpc.videos.getPlaylistMetadata.queryOptions({
          playlistId: playlistId || "",
        })
  );

  // Map the result to the appropriate format
  const getUploadsResponse = searchType === "channel" ? queryResult.data : undefined;
  const getPlaylistResponse = searchType === "playlist" ? queryResult.data : undefined;
  const getUploadsError = searchType === "channel" ? queryResult.error : null;
  const getPlaylistError = searchType === "playlist" ? queryResult.error : null;
  const getUploadsQueryIsLoading = searchType === "channel" ? queryResult.isLoading : false;
  const getPlaylistQueryIsLoading = searchType === "playlist" ? queryResult.isLoading : false;

  const currentPageToken = pageTokens.get(currentPage) || "";
  const activePlaylistId = searchType === "channel" ? uploadsPlaylistId : (playlistId || "");
  const activeChannelHandle = searchType === "channel" ? channelHandle : (getPlaylistResponse?.channelHandle || "");
  
  const {
    data: currentPageVideosMetadata,
    error: currentPageVideosError,
    isLoading: getNextVideosForPlaylistQueryIsLoading,
  } = useQuery({
    ...trpc.videos.getNextVideosForPlaylist.queryOptions({
      channelHandle: activeChannelHandle,
      playlistId: activePlaylistId,
      nextToken: currentPageToken,
      currentPage,
    }),
    enabled: !!activePlaylistId && !pageCache.has(currentPage),
  });

  useEffect(() => {
    setApiError(
      getUploadsError?.message || 
      getPlaylistError?.message || 
      currentPageVideosError?.message || 
      null
    );
  }, [getUploadsError, getPlaylistError, currentPageVideosError]);

  const isLoading = useMemo(
    () => getUploadsQueryIsLoading || getPlaylistQueryIsLoading || getNextVideosForPlaylistQueryIsLoading,
    [getUploadsQueryIsLoading, getPlaylistQueryIsLoading, getNextVideosForPlaylistQueryIsLoading]
  );

  const currentVideos = useMemo(() => {
    // First check cache
    if (pageCache.has(currentPage)) {
      return pageCache.get(currentPage) || [];
    }
    // Fall back to API response
    return currentPageVideosMetadata?.videos || [];
  }, [currentPageVideosMetadata, pageCache, currentPage]);

  // Cache videos and manage page tokens when API response arrives
  useEffect(() => {
    if (currentPageVideosMetadata?.videos && currentPageVideosMetadata.forPage) {
      const { videos, nextToken, forPage } = currentPageVideosMetadata;
      
      // Cache the videos for this page
      setPageCache(prev => {
        const newCache = new Map(prev);
        newCache.set(forPage, videos);
        return newCache;
      });
      
      // Store the next page token
      if (nextToken) {
        setPageTokens(prev => {
          const newTokens = new Map(prev);
          newTokens.set(forPage + 1, nextToken);
          return newTokens;
        });
      }
    }
  }, [currentPageVideosMetadata]);

  // Handle uploads metadata (channel search)
  useEffect(() => {
    if (
      searchType === "channel" &&
      getUploadsResponse?.uploadsPlaylistId &&
      typeof getUploadsResponse?.totalVideoCount === "number"
    ) {
      setUploadsPlaylistId(getUploadsResponse.uploadsPlaylistId);
      setTotalVideoCount(getUploadsResponse.totalVideoCount);

      // Calculate total pages based on total video count
      const calculatedTotalPages = Math.ceil(
        getUploadsResponse.totalVideoCount / 20
      );
      setTotalPages(calculatedTotalPages);

      // Cache first page videos if available
      if (getUploadsResponse.firstPageVideos) {
        setPageCache(prev => {
          const newCache = new Map(prev);
          newCache.set(1, getUploadsResponse.firstPageVideos);
          return newCache;
        });

        // Store the next page token for page 2
        if (getUploadsResponse.nextToken) {
          setPageTokens(prev => {
            const newTokens = new Map(prev);
            newTokens.set(2, getUploadsResponse.nextToken!);
            return newTokens;
          });
        }
      }
    }
  }, [getUploadsResponse, searchType]);

  // Handle playlist metadata (playlist search)
  useEffect(() => {
    if (
      searchType === "playlist" &&
      getPlaylistResponse?.playlistId &&
      typeof getPlaylistResponse?.totalVideoCount === "number"
    ) {
      setUploadsPlaylistId(getPlaylistResponse.playlistId);
      setTotalVideoCount(getPlaylistResponse.totalVideoCount);

      // Calculate total pages based on total video count
      const calculatedTotalPages = Math.ceil(
        getPlaylistResponse.totalVideoCount / 20
      );
      setTotalPages(calculatedTotalPages);

      // Cache first page videos if available
      if (getPlaylistResponse.firstPageVideos) {
        setPageCache(prev => {
          const newCache = new Map(prev);
          newCache.set(1, getPlaylistResponse.firstPageVideos);
          return newCache;
        });

        // Store the next page token for page 2
        if (getPlaylistResponse.nextToken) {
          setPageTokens(prev => {
            const newTokens = new Map(prev);
            newTokens.set(2, getPlaylistResponse.nextToken!);
            return newTokens;
          });
        }
      }
    }
  }, [getPlaylistResponse, searchType]);

  // Navigation functions
  const previousPage = useCallback(() => {
    if (currentPage <= 1) {
      return;
    }
    setCurrentPage(currentPage - 1);
  }, [currentPage]);

  const nextPage = useCallback(() => {
    const hasNextPageToken = pageTokens.has(currentPage + 1);
    const hasNextPageCached = pageCache.has(currentPage + 1);
    
    // Can go to next page if we have a token for it, or it's cached, or we're not at the calculated total
    if (hasNextPageToken || hasNextPageCached || currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, pageTokens, pageCache, totalPages]);

  const addVideoToSelection = (video: YoutubeVideo) => {
    setSelectedVideos((prev) => [...prev, video]);
  };

  const removeVideoFromSelection = (video: YoutubeVideo) => {
    setSelectedVideos((prev) =>
      prev.filter((v) => v.youtubeId !== video.youtubeId)
    );
  };

  const clearError = useCallback(() => {
    setApiError(null);
  }, []);

  return {
    data: {
      selectedVideos,
      currentVideos,
      isLoading,
    },
    pagination: {
      currentPage,
      totalPages,
      totalVideoCount,
      previousPage,
      nextPage,
      canGoBack: currentPage > 1,
      canGoForward: 
        pageTokens.has(currentPage + 1) || 
        pageCache.has(currentPage + 1) || 
        currentPage < totalPages,
    },
    error: {
      apiError,
      clearError,
    },
    addVideoToSelection,
    removeVideoFromSelection,
  };
};
