import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Video } from "@/generated/prisma";

type SortField = keyof Video;

type SortDirection = "asc" | "desc" | "none";

export const useVideoTableState = ({ userEmail }: { userEmail: string }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>();
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideoText, setSelectedVideoText] = useState("");
  const itemsPerPage = 20;

  const trpc = useTRPC();

  const queryClient = useQueryClient();

  const { data: videos, error: getAllVideosError } = useSuspenseQuery(
    trpc.videos.getAll.queryOptions({
      userEmail,
    })
  );

  useEffect(() => {
    if (getAllVideosError) {
      toast.error(getAllVideosError.message);
    }
  }, [getAllVideosError]);

  // const syncVideosHandler = useMutation(
  //   trpc.videos.syncVideos.mutationOptions({
  //     onError: (error) => {
  //       toast.error(error.message);

  //       // if (error.data?.code === "UNAUTHORIZED") {
  //       //   clerk.openSignIn();
  //       // }

  //       // if (error.data?.code === "TOO_MANY_REQUESTS") {
  //       //   router.push("/pricing");
  //       // }
  //     },
  //     onSuccess: () => {
  //       toast.success("Videos synced successfully!");

  //       queryClient.invalidateQueries(
  //         trpc.videos.getAll.queryOptions({ channelHandle })
  //       );
  //     },
  //   })
  // );

  const transcribeNextNHandler = useMutation(
    trpc.transcriptions.transcriptNextN.mutationOptions({
      onError: (error) => {
        toast.error(error.message);

        // if (error.data?.code === "UNAUTHORIZED") {
        //   clerk.openSignIn();
        // }

        // if (error.data?.code === "TOO_MANY_REQUESTS") {
        //   router.push("/pricing");
        // }
      },
      onSuccess: () => {
        toast.success("Videos transcribed successfully!");

        queryClient.invalidateQueries(
          trpc.videos.getAll.queryOptions({ userEmail })
        );
      },
    })
  );

  const transcribeNextN = useCallback(
    async ({ batchSize, n }: { batchSize: number; n: number }) => {
      await transcribeNextNHandler.mutateAsync({ batchSize, n });
    },
    [transcribeNextNHandler]
  );

  // const handleSync = useCallback(async () => {
  //   await syncVideosHandler.mutateAsync({ userEmail });
  // }, [syncVideosHandler, userEmail]);

  const openModal = (text: string) => {
    setSelectedVideoText(text);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVideoText("");
  };

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

  return {
    data: {
      currentVideos,
      videos,
    },
    pagination: {
      currentPage,
      totalPages,
      handlePreviousPage,
      handleNextPage,
    },
    state: {
      // isSyncing: syncVideosHandler.isPending,
      isTranscribing: transcribeNextNHandler.isPending,
      isModalOpen,
      selectedVideoText,
    },
    handleSort,
    transcribeNextN,
    getSortIcon,
    // handleSync,
    openModal,
    closeModal,
  };
};
