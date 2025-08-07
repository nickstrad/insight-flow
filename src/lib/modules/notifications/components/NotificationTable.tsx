"use client";

import { Suspense, useState } from "react";
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
import { SquareArrowOutUpRight, Trash2, Check, CheckCheck } from "lucide-react";
import { useNotificationTableState } from "./hooks";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NotificationTableProps {
  userEmail: string;
}

function NotificationTableContent({
  userEmail,
}: NotificationTableProps) {
  const {
    pagination: { currentPage, totalPages, handlePreviousPage, handleNextPage },
    state: { isModalOpen, selectedNotificationMessage, selectedNotifications },
    data: { currentNotifications, notifications },
    handleSort,
    getSortIcon,
    openModal,
    closeModal,
    toggleNotificationSelection,
    toggleAllNotifications,
    isAllSelected,
    clearSelection,
  } = useNotificationTableState({ userEmail });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMarkReadModalOpen, setIsMarkReadModalOpen] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Mark as read mutations
  const markAsReadMutation = useMutation(
    trpc.notifications.markNotificationAsRead.mutationOptions({
      onSuccess: () => {
        toast.success("Notification marked as read");
        queryClient.invalidateQueries(
          trpc.notifications.getNotificationsForUser.queryOptions({ userEmail })
        );
      },
      onError: (error) => {
        toast.error(`Failed to mark as read: ${error.message}`);
      },
    })
  );

  const markAllAsReadMutation = useMutation(
    trpc.notifications.markAllNotificationsAsRead.mutationOptions({
      onSuccess: () => {
        toast.success("All notifications marked as read");
        queryClient.invalidateQueries(
          trpc.notifications.getNotificationsForUser.queryOptions({ userEmail })
        );
        clearSelection();
        setIsMarkReadModalOpen(false);
      },
      onError: (error) => {
        toast.error(`Failed to mark as read: ${error.message}`);
      },
    })
  );

  // Delete mutations
  const deleteNotificationMutation = useMutation(
    trpc.notifications.deleteNotification.mutationOptions({
      onSuccess: () => {
        toast.success("Notification deleted");
        queryClient.invalidateQueries(
          trpc.notifications.getNotificationsForUser.queryOptions({ userEmail })
        );
      },
      onError: (error) => {
        toast.error(`Failed to delete: ${error.message}`);
      },
    })
  );

  const batchDeleteMutation = useMutation(
    trpc.notifications.batchDeleteNotifications.mutationOptions({
      onSuccess: () => {
        toast.success("Selected notifications deleted");
        queryClient.invalidateQueries(
          trpc.notifications.getNotificationsForUser.queryOptions({ userEmail })
        );
        clearSelection();
        setIsDeleteModalOpen(false);
      },
      onError: (error) => {
        toast.error(`Failed to delete: ${error.message}`);
      },
    })
  );

  const handleNotificationClick = async (
    notificationId: string,
    isRead: boolean
  ) => {
    if (!isRead) {
      try {
        await markAsReadMutation.mutateAsync({
          notificationId,
          userEmail,
        });
      } catch (error) {
        console.error("Mark as read error:", error);
      }
    }
  };

  const handleMarkSelectedAsRead = () => {
    setIsMarkReadModalOpen(true);
  };

  const handleConfirmMarkAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync({ userEmail });
    } catch (error) {
      console.error("Mark all as read error:", error);
    }
  };

  const handleDeleteSelected = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (selectedNotifications.length > 0) {
        await batchDeleteMutation.mutateAsync({
          notificationIds: selectedNotifications,
          userEmail,
        });
      }
    } catch (error) {
      console.error("Delete notifications error:", error);
    }
  };

  const truncateMessage = (message: string, maxLength: number = 100) => {
    return message.length > maxLength
      ? message.substring(0, maxLength) + "..."
      : message;
  };

  const selectedCount = selectedNotifications.length;
  const hasUnreadSelected = currentNotifications
    .filter((n) => selectedNotifications.includes(n.id))
    .some((n) => !n.read);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Manage your notifications and stay updated on system activities.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-md">
            <span className="text-sm text-gray-600">
              {selectedCount} selected
            </span>
            {hasUnreadSelected && (
              <Button
                onClick={handleMarkSelectedAsRead}
                variant="outline"
                size="sm"
                className="text-green-600 border-green-600 hover:bg-green-50"
                disabled={markAllAsReadMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Mark as Read
              </Button>
            )}
            <Button
              onClick={handleDeleteSelected}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50"
              disabled={batchDeleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleAllNotifications}
                />
              </TableHead>
              <TableHead onClick={() => handleSort("type")}>
                <div className="flex items-center gap-1">
                  Type {getSortIcon("type")}
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("message")}>
                <div className="flex items-center gap-1">
                  Message {getSortIcon("message")}
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("read")}>
                <div className="flex items-center gap-1">
                  Status {getSortIcon("read")}
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("createdAt")}>
                <div className="flex items-center gap-1">
                  Created {getSortIcon("createdAt")}
                </div>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentNotifications.map((notification) => (
              <TableRow
                key={notification.id}
                className={notification.read ? "opacity-60" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedNotifications.includes(notification.id)}
                    onCheckedChange={() =>
                      toggleNotificationSelection(notification.id)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {notification.type.replace("_", " ").toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div
                    className={`flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded ${
                      !notification.read ? "font-medium" : ""
                    }`}
                    onClick={() =>
                      handleNotificationClick(
                        notification.id,
                        notification.read
                      )
                    }
                  >
                    <div className="truncate flex-1 pr-2">
                      {truncateMessage(notification.message)}
                    </div>
                    {notification.message.length > 100 && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(notification.message);
                        }}
                        variant="ghost"
                        size="icon"
                      >
                        <SquareArrowOutUpRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={notification.read ? "secondary" : "default"}
                    >
                      {notification.read ? "Read" : "Unread"}
                    </Badge>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(notification.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <Button
                        onClick={() =>
                          handleNotificationClick(
                            notification.id,
                            notification.read
                          )
                        }
                        variant="ghost"
                        size="icon"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Mark as read"
                        disabled={markAsReadMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      onClick={async () => {
                        try {
                          await deleteNotificationMutation.mutateAsync({
                            notificationId: notification.id,
                            userEmail,
                          });
                        } catch (error) {
                          console.error("Delete notification error:", error);
                        }
                      }}
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete notification"
                      disabled={deleteNotificationMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {notifications.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No notifications found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        {notifications.length > 0 && (
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
            <DialogTitle>Full Message</DialogTitle>
            <DialogDescription>
              <div className="whitespace-pre-wrap break-words overflow-y-auto max-h-96">
                {selectedNotificationMessage}
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isMarkReadModalOpen}
        onOpenChange={setIsMarkReadModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Selected as Read</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark all selected notifications as read?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markAllAsReadMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMarkAsRead}
              disabled={markAllAsReadMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {markAllAsReadMutation.isPending ? "Marking..." : "Mark as Read"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Notifications</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected {selectedCount}{" "}
              notification{selectedCount !== 1 ? "s" : ""}? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={batchDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {batchDeleteMutation.isPending
                ? "Deleting..."
                : "Delete Selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const NotificationTableSkeleton = () => (
  <Card>
    <CardHeader>
      <CardTitle>Notifications</CardTitle>
      <CardDescription>
        Manage your notifications and stay updated on system activities.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox disabled />
            </TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(10)].map((_, i) => (
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
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
    <CardFooter>
      <div className="flex items-center justify-between w-full">
        <span className="mx-4 text-sm text-gray-700">Loading...</span>
      </div>
    </CardFooter>
  </Card>
);

export default function NotificationTable({
  userEmail,
}: NotificationTableProps) {
  return (
    <Suspense fallback={<NotificationTableSkeleton />}>
      <NotificationTableContent userEmail={userEmail} />
    </Suspense>
  );
}
