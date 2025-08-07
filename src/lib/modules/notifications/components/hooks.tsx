import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Notification } from "@/generated/prisma";

type SortField = keyof Notification;

type SortDirection = "asc" | "desc" | "none";

export const useNotificationTableState = ({ userEmail }: { userEmail: string }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNotificationMessage, setSelectedNotificationMessage] = useState("");
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const itemsPerPage = 20;

  const trpc = useTRPC();

  const { data: notifications, error: getAllNotificationsError } = useSuspenseQuery(
    trpc.notifications.getNotificationsForUser.queryOptions({
      userEmail,
    })
  );

  useEffect(() => {
    if (getAllNotificationsError) {
      toast.error(getAllNotificationsError.message);
    }
  }, [getAllNotificationsError]);

  const openModal = (message: string) => {
    setSelectedNotificationMessage(message);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedNotificationMessage("");
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const toggleAllNotifications = () => {
    if (selectedNotifications.length === currentNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(currentNotifications.map(n => n.id));
    }
  };

  const clearSelection = () => {
    setSelectedNotifications([]);
  };

  // Sort notifications
  const { currentNotifications, totalPages } = useMemo(() => {
    const sortedNotifications = [...notifications].sort((a, b) => {
      if (!sortField || sortDirection === "none") return 0;

      const aValue = a[sortField] ?? "";
      const bValue = b[sortField] ?? "";

      if (aValue === bValue) return 0;

      // Handle different data types
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = aValue === bValue ? 0 : (aValue ? 1 : -1);
      } else {
        comparison = aValue < bValue ? -1 : 1;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    const totalPages = Math.ceil(sortedNotifications.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentNotifications = sortedNotifications.slice(startIndex, endIndex);

    return {
      currentNotifications,
      totalPages,
    };
  }, [sortField, sortDirection, notifications, currentPage]);

  const isAllSelected = useMemo(() => {
    return currentNotifications.length > 0 && 
           selectedNotifications.length === currentNotifications.length &&
           currentNotifications.every(n => selectedNotifications.includes(n.id));
  }, [currentNotifications, selectedNotifications]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField("createdAt");
        setSortDirection("desc");
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
      currentNotifications,
      notifications,
    },
    pagination: {
      currentPage,
      totalPages,
      handlePreviousPage,
      handleNextPage,
    },
    state: {
      isModalOpen,
      selectedNotificationMessage,
      selectedNotifications,
    },
    selection: {
      toggleNotificationSelection,
      toggleAllNotifications,
      clearSelection,
      isAllSelected,
    },
    handleSort,
    getSortIcon,
    openModal,
    closeModal,
    toggleNotificationSelection,
    toggleAllNotifications,
    clearSelection,
    isAllSelected,
  };
};