import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, MessageSquare, Video, Info } from "lucide-react";

interface QuotaViewerProps {
  userEmail: string;
}

const QuotaViewer = ({ userEmail }: QuotaViewerProps) => {
  const trpc = useTRPC();

  const { data: quota } = useSuspenseQuery(
    trpc.quotas.getQuota.queryOptions({
      userEmail,
    })
  );

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const getUsagePercentage = (used: number, total: number) => {
    return Math.round(((total - used) / total) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const messagesUsed = 100 - quota.messagesLeft;
  const videoHoursUsed = 10 - quota.videoHoursLeft;

  const QuotaDetailsModal = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages Quota
          </CardTitle>
          <CardDescription>Track your monthly message usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Messages remaining</span>
            <Badge
              variant={quota.messagesLeft > 20 ? "default" : "destructive"}
            >
              {quota.messagesLeft} / 100
            </Badge>
          </div>
          <Progress
            value={getUsagePercentage(quota.messagesLeft, 100)}
            className="h-2"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Used: {messagesUsed}</span>
            <span
              className={getUsageColor(
                getUsagePercentage(quota.messagesLeft, 100)
              )}
            >
              {getUsagePercentage(quota.messagesLeft, 100)}% remaining
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Hours Quota
          </CardTitle>
          <CardDescription>
            Track your monthly video transcription hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Hours remaining</span>
            <Badge
              variant={quota.videoHoursLeft > 2 ? "default" : "destructive"}
            >
              {quota.videoHoursLeft} / 10 hours
            </Badge>
          </div>
          <Progress
            value={getUsagePercentage(quota.videoHoursLeft, 10)}
            className="h-2"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Used: {videoHoursUsed} hours</span>
            <span
              className={getUsageColor(
                getUsagePercentage(quota.videoHoursLeft, 10)
              )}
            >
              {getUsagePercentage(quota.videoHoursLeft, 10)}% remaining
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reset Information
          </CardTitle>
          <CardDescription>
            Your quota will reset on the first day of next month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Next reset date</span>
            <Badge variant="outline">{formatDate(quota.resetAt)}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Badge
            variant={quota.messagesLeft > 20 ? "secondary" : "destructive"}
            className="text-xs"
          >
            {quota.messagesLeft}/100
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <Badge
            variant={quota.videoHoursLeft > 2 ? "secondary" : "destructive"}
            className="text-xs"
          >
            {quota.videoHoursLeft}/10h
          </Badge>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quota Usage Details</DialogTitle>
          </DialogHeader>
          <QuotaDetailsModal />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuotaViewer;
