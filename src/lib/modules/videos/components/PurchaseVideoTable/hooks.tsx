import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { YoutubeVideo } from "../../types";

type SortField = keyof YoutubeVideo;

type SortDirection = "asc" | "desc" | "none";

export const useVideoTableState = ({
  channelHandle,
}: {
  channelHandle: string;
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>();
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<YoutubeVideo[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const itemsPerPage = 20;

  const trpc = useTRPC();

  const { data: fetchedVideos, error: getAllVideosError } = useSuspenseQuery(
    trpc.videos.getVideosForChannel.queryOptions({
      channelHandle,
    })
  );

  useEffect(() => {
    if (getAllVideosError) {
      setApiError(getAllVideosError.message);
    }
  }, [getAllVideosError]);

  useEffect(() => {
    setVideos(fetchedVideos);
  }, [fetchedVideos]);

  // Sort videos
  const { currentVideos, totalPages } = useMemo(() => {
    const sortedVideos = [...videos].sort((a, b) => {
      if (!sortField || sortDirection === "none") return 0;

      const aValue = a[sortField] ?? "";
      const bValue = b[sortField] ?? "";

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    const totalPages = Math.ceil(sortedVideos.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentVideos = sortedVideos.slice(startIndex, endIndex);

    return {
      currentVideos,
      totalPages,
    };
  }, [sortField, sortDirection, videos, currentPage]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(undefined);
        setSortDirection("none");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const getSortIcon = useCallback(
    (field: SortField) => {
      if (field !== sortField) return null;
      if (sortDirection === "none") return null;
      return sortDirection === "asc" ? (
        <ArrowUp className="w-4 h-4" />
      ) : (
        <ArrowDown className="w-4 h-4" />
      );
    },
    [sortField, sortDirection]
  );

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

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
      videos,
    },
    pagination: {
      currentPage,
      totalPages,
      handlePreviousPage,
      handleNextPage,
    },
    error: {
      apiError,
      clearError,
    },
    handleSort,
    getSortIcon,
    addVideoToSelection,
    removeVideoFromSelection,
  };
};
